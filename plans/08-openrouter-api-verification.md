# OpenRouter 分类接口核验与接入决定

核验日期：2026-10-15。范围：官方接口定义、官方 SDK 序列化字段与设计映射；未进行付费生成。

## 证据与核验边界

OpenRouter 官网、API 直连在本环境仍返回代理 403，通用网页检索工具不可用。本次成功读取 **OpenRouterTeam 官方 TypeScript SDK 仓库**中的 OpenAPI、请求实现和响应类型，固定到提交 **43d6d571164276be6052075ea33f46096c94d97f**。以下接口及字段是官方定义已确认，不代表本环境已收到线上接口的成功响应。

因此可以确定如何设计请求与读取字段；仍无法声称某个具体模型当前在线、某账号有权调用、价格是多少或宠物动作迁移效果已通过测试。没有读取到 Models 网页前端源码，不将下述 API 映射表述为已实测的网页内部请求。

生产 API 基址为 [OpenRouter API](https://openrouter.ai/api/v1)。来源：[官方 SDK 服务配置](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/lib/config.ts)。

## 1. 已确认的分类与筛选参数

官方通用模型目录使用 **GET /api/v1/models**。HTTP 查询使用 snake_case，TypeScript SDK 使用 camelCase；不要混用。来源：[模型列表请求实现](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/funcs/modelsList.ts)、[筛选参数定义](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/models/operations/getmodels.ts)。

| 需求 | HTTP 查询参数 | TypeScript SDK 字段 | 已确认语义 |
| --- | --- | --- | --- |
| Text 分类 | output_modalities=text | outputModalities | 筛选文本输出，省略该参数时默认 text |
| Video 分类 | output_modalities=video | outputModalities | 筛选视频输出，不等于视频输入 |
| Gemini 系列 | arch=Gemini | arch | 根据模型架构/系列筛选；官方描述明确列出 Gemini |
| 全部输出类别 | output_modalities=all | outputModalities | 显式查询全部类别；本项目不必默认全量抓取 |
| 名称或 slug 搜索 | q | q | 自由文本搜索，不作为 Gemini 身份判定依据 |
| 创建组织 | model_authors | modelAuthors | 创建模型的组织，不等价于模型系列 |
| 托管提供方 | providers | providers | 托管提供方，不等价于模型作者或系列 |
| 分页 | offset、limit | offset、limit | limit 最大 1000；本项目明确使用分页 |

**不能使用 category=Text 或 category=Video。** 官方 category 是编程、营销等用途分类，不是输出模态。也不能用 providers=Google 或 model_authors=google 代替 arch=Gemini。参数语义来源同上。

### 提示词下拉菜单的确定请求

采用 [Text + Gemini 模型列表](https://openrouter.ai/api/v1/models?output_modalities=text&arch=Gemini&offset=0&limit=1000)，即 **GET /api/v1/models?output_modalities=text&arch=Gemini&offset=0&limit=1000**；从第一页起遍历完整分页，不只保留首批结果。

服务端保留准确 id、canonical_slug、name，并核验 architecture.output_modalities 包含 text。官方 architecture.tokenizer 的类型为 ModelGroup，其中明确有 Gemini；该字段可作为返回结果的额外一致性检查，但为可选字段，缺失时不能伪造值，也不直接等同于模型不可用。以已确认的 arch 筛选来源及准确 ID 为主要依据；返回明确冲突的条目隔离并刷新。来源：[模型架构字段](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/models/modelarchitecture.ts)、[ModelGroup 定义](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/models/modelgroup.ts)。

输入能力读取 architecture.input_modalities；不要用它决定模型是否属于 Video 输出分类。Text 模型可以同时具备视觉输入能力。

### 通用列表的分页与响应

HTTP JSON 响应字段已确认包括 data、links.next 和 total_count；单项的模态位于 architecture.input_modalities 与 architecture.output_modalities。SDK 会将 total_count 映射为 totalCount。

设计采用显式 offset/limit：每次推进 offset，直到累计条目达到 total_count 或返回空页/不足一页；同时核对总数和目录一致性，按 id 去重，设置页数上限。中途失败或结果明显不一致时不将部分结果覆盖为完整目录，也不误报“没有模型”。可校验 links.next 作为分页一致性信号，但不对任意 next URL 盲目发起带密钥请求。来源：[列表响应定义](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/models/modelslistresponse.ts)、[SDK 分页实现](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/funcs/modelsList.ts)。

## 2. 视频目录有专用接口

除 [通用 Video 分类列表](https://openrouter.ai/api/v1/models?output_modalities=video&offset=0&limit=1000) 外，官方还定义 **GET /api/v1/videos/models**，专门列出视频模型及能力。对应 SDK 为 videoGeneration.listVideosModels；该接口请求定义中没有 output_modalities、arch、offset 或 limit 查询参数，不复制通用目录参数。来源：[视频列表请求实现](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/funcs/videoGenerationListVideosModels.ts)、[专用列表参数](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/models/operations/listvideosmodels.ts)。

| 视频列表 HTTP JSON 字段 | 本产品用途 |
| --- | --- |
| data[].id、canonical_slug、name | 准确模型身份及下拉显示名称 |
| supported_durations | 时长选择，单位为秒 |
| supported_aspect_ratios | 可选画幅 |
| supported_resolutions、supported_sizes | 分辨率和精确像素规格 |
| supported_frame_images | 首帧、尾帧等图像输入能力，不等于支持动作参考视频 |
| generate_audio | 是否支持伴随音频；本产品仍默认无声 |
| pricing_skus | 视频价格 SKU 数据，不冒充 token 单价或任务实耗 |
| allowed_passthrough_parameters | 可传递的供应商参数，不能由用户任意扩展 |

专用列表响应为 data 数组，不能假设具有通用列表的 architecture、links.next 或 total_count。多项能力字段允许 null；null 是未提供，不能当成无限制或支持全部。来源：[VideoModel HTTP 字段映射](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/models/videomodel.ts)、[专用列表响应](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/models/videomodelslistresponse.ts)。

### 本项目的目录合并决定

1. 用通用 output_modalities=video 查询落实用户要求的 Video 筛选。
2. 同时请求 /videos/models，按准确 id 或明确一致的 canonical_slug 补充可执行规格，不按显示名称猜测映射。
3. 已匹配且完成调用与素材兼容验证的条目才可选。通用目录有、专用列表没有的条目保留为“缺少视频能力信息”；专用列表独有条目暂不自动混入，先记录差异并复核。
4. 两个目录失败、不同步或未核实账号可用性时明确区分“目录加载失败”“待验证”“已确认空列表”，不把请求失败显示成 Video 不存在。

以上合并及禁用规则是本应用的产品决定，不是官方要求这两个列表完全一致。

## 3. 官方视频生成链路已确认存在

| 方法与路径 | 用途 |
| --- | --- |
| POST /api/v1/videos | 提交用户所选模型与最终提示词，异步生成 |
| GET /api/v1/videos/{jobId} | 查询任务状态与结果信息 |
| GET /api/v1/videos/{jobId}/content | 获取视频内容；查询参数 index 用于选择产物 |

来源：[提交实现](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/funcs/videoGenerationGenerate.ts)、[查询实现](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/funcs/videoGenerationGetGeneration.ts)、[内容下载实现](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/funcs/videoGenerationGetVideoContent.ts)。

因此架构默认使用 OpenRouter 原生视频链路，不再把“是否存在视频接口”列为未知，也不默认寻求独立托管替代。请求与密钥仅由服务端发出；定义存在不保证当前账号、地区和每个模型都可调用。

### 请求、状态与参考素材限制

HTTP 请求包含 model、prompt，并按所选模型能力使用 duration、aspect_ratio、resolution 或 size、frame_images、input_references、generate_audio。SDK 对应名称是 frameImages、inputReferences、generateAudio 等，不把 SDK 名称原样发送为 HTTP JSON 字段。来源：[官方视频请求定义](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/models/videogenerationrequest.ts)。

input_references 可承载图像、音频、视频；但官方明确说明音频和视频参考仅被支持它们的提供方使用，其他提供方可能忽略这些参考。**不能因为请求被接受或任务成功就宣称参考舞蹈生效。** 宠物动作迁移仍需逐模型、逐路由验证，并防止路由到忽略视频参考的端点。supported_frame_images 只能证明相应图像帧能力，不能代替此验证。来源：[InputReference 定义与限制](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/models/inputreference.ts)。

响应字段包括 id、polling_url、status，以及可选 generation_id、unsigned_urls、usage。status 定义包含 pending、in_progress、completed、failed、cancelled、expired；本产品将其映射到内部状态，completed 后仍需下载、解码和存储检查才完成作品。expired 不能显示为成功。来源：[视频响应与状态定义](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/models/videogenerationresponse.ts)。

本次核验的官方视频操作未提供取消方法或可靠幂等承诺；出现 cancelled 状态不等于客户端已有可调用取消接口。首版提交后以轮询为可靠恢复路径；callback_url 虽有请求字段，回调签名方案仍未核验，不能因此启用未经鉴权的回调。SDK 请求实现含重试配置，付费 POST 须显式采用“不对未知结果自动重提”的应用策略，不能直接继承默认重试后假定不会重复计费。

## 4. 对用量展示的已确认补充

视频完成响应可携带 usage，其中 **usage.cost 的官方定义是 USD 视频生成成本**，另有 is_byok。该视频用量类型没有输入/输出 token 字段，因此视频费用单列为 USD，不能按视频时长制造 token，也不能把 USD 数字无说明地标为任意应用 credit。来源：[视频用量定义](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/models/videogenerationusage.ts)。

提示词模型的 token 展示和任务 OpenRouter 实耗仍保留；credit 的官方计量关系、完整调用账单核对和 BYOK 对费用的影响需另行核验。USD 可原样显示；credit 换算未确认时显示“credit 换算待确认”，不隐藏已经确认的实际金额。视频任务 id 与可选 generation_id 都保存并建立关联，避免后续账单查询及去重混淆。

## 5. 账号可用性与实施前剩余验证

官方另提供 **GET /api/v1/models/user**，SDK 为 models.listForUser，按调用账号的提供方偏好、隐私及 guardrail 设置筛选；其请求支持 output_modalities 与分页，没有 arch 查询字段。可在服务端取得 text / video 的账号列表后与已筛好的候选 ID 交叉核验，不能向该路径传 arch 并声称已完成 Gemini 筛选。应用共用密钥时，这里的“user”是应用的 OpenRouter 账号，并非 Web App 每个终端用户。来源：[账号目录实现](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/funcs/modelsListForUser.ts)、[账号目录参数](https://github.com/OpenRouterTeam/typescript-sdk/blob/43d6d571164276be6052075ea33f46096c94d97f/src/models/operations/listmodelsuser.ts)。

剩余待办限定为：在可访问网络下请求上述目录确认实时响应；核验账号权限、路由、限流及定价；对图像加舞蹈参考做真实模型质量验证；确认回调鉴权、幂等/取消、credit 单位和账单对账。无需继续猜测 Text / Video 应使用什么参数，也无需另造类别接口或抓取网页。

本次仅更新设计；未安装 SDK、未编写应用代码、未使用密钥或发起付费请求。
