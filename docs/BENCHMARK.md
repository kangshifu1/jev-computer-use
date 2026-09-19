# 同一浏览器适配器的控制方式耗时对比

2026-09-19，在同一台机器、Chrome `153.0.8010.48`、1440×940 视口上，交替执行
Jev 和当前 Codex 会话各三轮。任务均为打开 Reports → 选择 Daily report → 筛选异常。
全部使用独立浏览器配置、合成数据，没有录屏或人为等待。

**本次 Codex 数据来自当前会话逐步调用同一个 Playwright 适配器，不是 Codex 原生
Browser / Computer Use Skill 的成绩。原生 Skill 在当前任务中未启用，仍为未测。**

| 控制方式 | 第 1 轮 | 第 2 轮 | 第 3 轮 | 执行与核验中位数 | 每轮含启动的总时间中位数 | 核验 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Jev `jev-1.13.0` + 共享适配器 | 2.21 s | 2.13 s | 3.07 s | **2.21 s** | 4.41 s | 3/3 通过 |
| 当前 Codex 会话 + 共享适配器 | 25.82 s | 23.50 s | 28.37 s | **25.82 s** | 27.06 s | 3/3 通过 |
| Codex 原生 Browser Skill | — | — | — | 未测 | 未测 | 未测 |

“每轮含启动的总时间”先逐轮相加再取中位数，不是将两列中位数相加。
原始记录：[controller-benchmark-2026-09-19.json](controller-benchmark-2026-09-19.json)。

逐轮总时间如下，直接根据已有启动与执行计时相加，未重跑或修改原始计时：

| 控制方式 | 第 1 轮总时间 | 第 2 轮总时间 | 第 3 轮总时间 |
| --- | ---: | ---: | ---: |
| Jev | 5.12 s | 3.23 s | 4.41 s |
| 当前 Codex 会话 + 共享适配器 | 27.06 s | 24.82 s | 30.07 s |

JSON 每轮新增 `totalMs = setupMs + loopAndVerificationMs`，汇总新增
`medianTotalMs`、`minTotalMs`、`maxTotalMs`。总时间不含测试工具准备、浏览器关闭和写报告。

## 计时口径

- 浏览器启动、创建隔离环境和页面加载单列为 `setupMs`。
- `loopAndVerificationMs` 从第一次读取页面前开始，到四项独立 DOM 检查完成为止。
  不含关闭浏览器、写报告、前置查阅 Skill 或连接测试工具的时间。
- 两边都实际点击三次，并核对日报标题、两条结果行、筛选勾选状态、日报标签选中状态。
- Codex 每次读取新页面后选择一个点击，再读取新状态；没有把动作写死在循环里执行。
  Jev 运行相同目标与有界控件列表，并完成自己的 DONE 判断和新鲜度检查。
- `browserToolMs` 包含快照、实际操作和最终核验。中位数分别为 Jev **0.219 s**、
  Codex **0.227 s**；两种控制方式的快照次数并不相同。
- Jev 的 API 请求时间合计中位数约 **1.905 s**，包含网络与提供商处理。
  Codex 的纯模型耗时未开放；`hostRoundTripAndReasoningMs` 是总时间减去浏览器工具时间，
  包含思考、传输、调度及工具调用之间的间隔，**不能称为纯推理耗时**。

## 结论适用范围

这说明当前测试中，把每一步交给 Jev 的本地循环完成，比当前 Codex 会话逐次调用工具
具有更小的端到端开销。它不证明某个模型普遍更快或更准，也不能外推到原生 Browser
Skill、允许批量点击的 Codex 工作流、其他任务、模型或推理档位。

当前 Codex 会话已包含这套页面的演示历史；它与 Jev 请求的上下文长度、服务设置不同。
本次没有单独取得 Codex 的具体模型变体，因此记录保留为 `current Codex session`。
只有每边三次、同一个重复任务，不足以估计 p95、通用可靠性或复杂网站表现。
之前为了演示添加停顿的录像不参与这组计时。

## 复现

安装仓库依赖并确保本机 Chrome 可用。准备只在本机保存的 dotenv 文件，内容为
`TYPESAFE_API_KEY=...`。不要把该文件加入 Git。

```sh
JEV_BENCH_ENV_FILE=/absolute/path/to/private.env node scripts/benchmark-server.mjs
```

服务器仅监听 `127.0.0.1`，打印随机端口。向该端口 POST JSON：

1. `{"command":"jev"}` 运行 Jev 一轮。
2. `{"command":"begin"}` 开始 Codex 一轮并返回初始观察。
3. 由 Codex **根据每次返回的观察**选择 `{"command":"click","index":N}`。
   不得把上一轮的索引当作未观察页面的证据，也不要在计时期间插入无关工作。
4. 判断任务完成后调用 `{"command":"finish"}`，宿主独立核验并停止计时。
5. 交替重复三轮后调用 `{"command":"save"}` 写入记录，再调用 `{"command":"close"}`。

底层实现为 [benchmark-session.mjs](../scripts/benchmark-session.mjs)。它只为开发比较提供
共享的浏览器执行接口，不属于 Codex 官方 Browser Skill，不会自动启用原生浏览器连接。
重新运行会覆盖同名记录；发布新结果前应使用对应的日期并记录模型及测试条件。
