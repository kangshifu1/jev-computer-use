import { checkAssertions } from './contracts.mjs';

const selector = 'button,a[href],input,textarea,select,summary,[role="button"],[role="link"],[role="checkbox"],[role="tab"],[role="menuitem"],[role="radio"]';
const clean = s => String(s ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

export function createPlaywrightTab(page, allowedOrigins) {
  let observed = [];
  let lastSnapshot = null;
  function checkOrigin() {
    if (!allowedOrigins.includes(new URL(page.url()).origin)) throw new Error('Browser left authorized origins');
  }
  async function snapshot() {
    checkOrigin();
    const entries = await page.locator(selector).evaluateAll(nodes => nodes.map((el, slot) => {
      const style = getComputedStyle(el);
      if (!el.getClientRects().length || style.visibility === 'hidden' || style.display === 'none' || el.closest('[hidden],[aria-hidden="true"]') || el.disabled) return null;
      if (el.tagName === 'INPUT' && ['password', 'hidden'].includes(el.type)) return null;
      const role = el.getAttribute('role') || ({ BUTTON: 'button', A: 'link', SUMMARY: 'button', TEXTAREA: 'text area', SELECT: 'combo box' })[el.tagName] || (el.type === 'checkbox' ? 'checkbox' : el.type === 'radio' ? 'radio button' : ['submit', 'button'].includes(el.type) ? 'button' : 'text field');
      const labelledBy = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
      const name = el.getAttribute('aria-label') || labelledBy || Array.from(el.labels || []).map(l => l.textContent).join(' ') || el.innerText || el.getAttribute('title') || el.getAttribute('placeholder') || (['submit', 'button'].includes(el.type) ? el.value : '');
      return { slot, role: ({ menuitem: 'menuItem', radio: 'radioButton' })[role] || role, name, href: el.getAttribute('href') || '', checked: el.getAttribute('aria-checked') ?? (el.type === 'checkbox' ? String(el.checked) : ''), expanded: el.getAttribute('aria-expanded') || '' };
    }).filter(Boolean));
    observed = entries.filter(e => clean(e.name)).map(e => ({ ...e, name: clean(e.name) }));
    if (observed.length > 200 || observed.some(e => e.name.length > 500)) throw new Error('Page too complex; narrow the task');
    const body = clean(await page.locator('body').innerText()).slice(0, 10000);
    const lines = observed.map((e, i) => `${i + 1} ${e.role} ${e.name}`);
    // Include targets/state in the fingerprint so changing hrefs/toggles invalidates an old decision.
    const details = JSON.stringify(observed.map(({ slot, ...e }) => e));
    const result = `Browser tab: "${clean(await page.title()).replaceAll('"', '')}" URL: "${page.url()}".\n${lines.join('\n')}\nPage text: ${body}\nControl state: ${details}`;
    if (result.length > 24000) throw new Error('Snapshot too large; narrow the task');
    lastSnapshot = result;
    return result;
  }
  return {
    getAXState: snapshot,
    async click(index) {
      const previous = lastSnapshot;
      if (!previous || await snapshot() !== previous) throw new Error('Stale page state');
      const target = observed[index - 1];
      if (!target) throw new Error('Unknown observed control');
      if (target.href && !allowedOrigins.includes(new URL(target.href, page.url()).origin)) throw new Error('Link outside allowedOrigins');
      await page.locator(selector).nth(target.slot).click({ timeout: 5000 });
    },
    async pressKey(key) {
      checkOrigin();
      if (!['PageUp', 'PageDown', 'Escape', 'Tab', 'Shift+Tab', 'Home', 'End'].includes(key)) throw new Error('Unsupported standalone key');
      await page.keyboard.press(key);
    },
    async scroll() { throw new Error('Targeted scrolling requires host intervention in the standalone adapter'); },
    async reload() { checkOrigin(); await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }); },
    async verify(assertions) {
      checkOrigin();
      return checkAssertions(assertions, { text: clean(await page.locator('body').innerText()), url: page.url() });
    }
  };
}

export async function launchBrowser({ browser = 'chromium', headless = true, allowedOrigins }) {
  if (!['chromium', 'chrome'].includes(browser)) throw new Error('Supported browsers: chromium, chrome');
  const { chromium } = await import('playwright');
  const instance = await chromium.launch({ headless, ...(browser === 'chrome' ? { channel: 'chrome' } : {}) });
  try {
    const context = await instance.newContext({ acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const req = route.request();
      if (req.isNavigationRequest() && !allowedOrigins.includes(new URL(req.url()).origin)) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    context.on('page', other => { if (other !== page) void other.close(); });
    page.on('dialog', dialog => void dialog.dismiss());
    return { page, tab: createPlaywrightTab(page, allowedOrigins), close: () => instance.close() };
  } catch (error) { await instance.close(); throw error; }
}
