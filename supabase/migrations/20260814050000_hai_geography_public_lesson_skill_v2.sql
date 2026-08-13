begin;

do $$
declare
  v_payload jsonb := $subjectskill${"skill_slug":"subject-lesson-design-geography","source_skill_name":"geography-public-lesson-design","version_label":"v2.0.0","snapshot_hash":"f36f2b8bbf0e92e7dec7e846a5a126ae13891ef70d5120e325f89a78272e28f9","instructions":"---\nname: geography-public-lesson-design\ndescription: Design complete junior-secondary geography public lessons from precisely matched textbooks, maps and datasets, selecting a discipline-specific pathway for map-tool inquiry, spatial distribution explanation, regional comparison, human-environment systems analysis, fieldwork, or territorial planning decisions. Use for 初中地理公开课、优质课、展示课、赛课 requiring scale-aware map reading, multi-factor causal reasoning, regional evidence, practice, assessment, and reflection.\n---\n\n# 地理公开课设计\n\n把准确教材、地图、图表和地域资料转化为一节学生能定位、描述分布、比较区域、解释联系并作空间决策的地理公开课。不能用旅游视频、景观堆叠或“读图回答”替代区域认知、综合思维和人地关系判断。\n\n## 运行门禁\n\n1. 核对年级、版本、册次、章、节、课时位置和实际地图/图表/活动页。\n2. 当前教材若只有官方目录摘要，只输出证据缺口和框架；无图名、图例、比例尺、时间、区域范围与数据来源时不得生成完整教案。\n3. 涉及中国地图须使用权威标准地图并完整呈现国界、南海诸岛等要素；不自行改画国家版图。\n4. 必读 [主流模式](references/mainstream-models.md)、[输出模板](references/output-template.md)、[初中样例](references/excellent-example-junior.md) 和 [来源边界](references/sources-and-boundaries.md)。\n\n## 工作流\n\n### 1. 建立空间—区域—人地地图\n\n提取空间位置与尺度、地理要素及分布、区域差异与联系、自然过程的时间变化、人类活动及反馈、地图/图表证据、地理工具和实践任务。分析必须回答“在哪里—有什么特征—为什么—与谁联系—怎样因地制宜”。\n\n### 2. 诊断地理起点\n\n识别方向/比例尺/图例误读、只报地名不描述分布、单因素决定论、相关即因果、把局部结论外推整个区域、尺度混用、静态地图解释动态过程、价值先行无证据等问题。无班情标“一般性预判”，用定位、描线、图表描述或方案排序诊断。\n\n### 3. 确定核心增长\n\n> 学生从“凭印象描述某地”，走向“能在明确尺度下，从哪些地图和数据提取证据，综合哪些要素与过程，解释何种区域差异、人地关系或空间方案”。\n\n目标2—4项，对齐个体地图标注、分布描述、区域证据表、因果链、剖面图、调查记录或规划方案。\n\n### 4. 选择主导模式\n\n- 地图/地球仪工具操作；\n- 空间分布模式识别与成因解释；\n- 区域特征归纳与跨区域比较；\n- 多要素综合与人地系统分析；\n- 地理实验、调查、野外考察；\n- 区域规划与多约束决策。\n\n按 [主流模式](references/mainstream-models.md) 的证据和失败信号执行。\n\n### 5. 设计地理证据链\n\n`定位与尺度→读图例/数据→描述空间格局→比较差异→提出多因素解释→用第二资料验证→分析人地反馈→新区域迁移/方案决策`。区分地图直接信息、计算加工、关系推断和价值判断；因果链写中间机制与反证。\n\n### 6. 写实践与评价\n\n每环写地图资料、来源年份、学生标注/量算/绘图/调查动作、个体证据、典型误读和反馈。户外实践写路线、天气交通、人员、隐私、危险点和取消条件；数字地图保留数据来源、投影/尺度和更新时间。\n\n### 7. 复核\n\n- 地图是否成为证据工具而非背景；\n- 描述是否含位置、方向、疏密、形态、范围与例外；\n- 是否明确尺度、区域边界和时间；\n- 综合解释是否避免单因素决定论；\n- 人地协调结论是否基于约束与权衡；\n- 是否有新区域迁移、全员证据、实践安全、评价与时间闭合。\n\n## 输出要求\n\n严格使用 [输出模板](references/output-template.md) 十三部分，Markdown 输出。资料不足、地图版权/版图/年份不明时停止完整生成并列补充项；样例只示范机制。","input_contract":{"format":"geography_public_lesson_input_v1","required":["stage","subject","grade","volume","unit","topic","lesson_type"],"supported_stages":["初中"],"evidence_gate":"maps_and_datasets_required_when_catalogue_only"},"output_contract":{"format":"geography_public_lesson_markdown_v1","required_sections":["课程基本信息","单元与区域定位","地理事象与资料分析","学情与地图能力起点","核心增长与目标—任务—证据","重难点与地理证据链","主导模式与课堂主线","地图数据、工具与实践安全","原始读图与分析工具","教学流程","板书与地图成果","评价量规、差异化与作业","教学反思与核验清单"],"lesson_flow_required":["环节功能/对应目标","区域/尺度","地图/数据资料","核心任务","个体先行证据","合作必要性","教师行为","学生地理实践","地图/数据要求","产出","典型误读","评价与反馈分支","核心素养落点","结论与尺度边界","阶段成果与过渡","时间核算"]},"source_metadata":{"source_package":"geography-public-lesson-design","source_kind":"repository_skill_source","source_file_count":6,"runtime_reference_count":4,"source_skill_hash":"55d8913bd6dd396d27e59f1a44a4a6c14931b7bd611f4e9b3542869d2874a912"},"references":[{"path":"references/mainstream-models.md","name":"初中地理公开课主流教学模式","description":"六类地理模式、地图证据、尺度与人地约束","media_type":"text/markdown","content":"# 初中地理公开课主流教学模式\n\n| 模式 | 核心循环 | 必须证据 | 失败信号 |\n|---|---|---|---|\n| 地图工具 | 任务→选图→图例方向比例尺→定位/量算→换尺度验证→导航表达 | 个体标图、量算过程、尺度说明 | 教师指图学生报地名 |\n| 分布—成因 | 描述格局→提取要素→提出假设→叠加第二资料→机制解释→例外修正 | 分布描述、叠图证据、因果链 | 未描述先解释；相关当因果 |\n| 区域比较 | 同尺度指标→分别归纳→异同→主导特征→区域联系→迁移 | 双栏证据表、共同指标、联系图 | 区域标签化；指标不一致 |\n| 人地系统 | 系统边界→自然/人文要素→相互作用→时序反馈→问题权衡→协调方案 | 要素关系图、反馈链、方案约束 | 环境决定论或空泛环保口号 |\n| 地理实践 | 真实问题→路线/工具/采样→现场记录→整理制图→解释→行动 | 原始点位、照片/记录、地图成果 | 打卡式研学；无空间记录 |\n| 规划决策 | 需求→候选区→地图/数据指标→权重与取舍→方案→风险评价→修订 | 多方案地图、指标矩阵、取舍理由 | 只有唯一正确方案；忽略成本生态 |\n\n## 地理证据规范\n\n- 所有地图写标题、范围、图例、方向/坐标、比例尺或尺度、数据年份与来源。\n- 描述空间分布先于解释，至少覆盖总体格局、集中区、稀疏区、延伸方向和异常。\n- 不同尺度结论不可直接互换；区域内部差异不能被平均值抹平。\n- 自然条件提供可能与约束，人类选择还受技术、市场、政策、历史和文化影响。\n- 中国版图采用自然资源部标准地图服务或权威教材图，按审图要求使用。","content_hash":"2f6b5be5143d0a27f9f771b8b8f286d7477fd8d011c0880c2f358b3a4094470e","load_mode":"always","max_chars":698,"sort_order":10,"metadata":{"source_package":"geography-public-lesson-design","runtime_role":"discipline_reference"}},{"path":"references/output-template.md","name":"初中地理公开课完整输出模板","description":"十三部分教案、地图数据、区域综合、实践安全与质量约束","media_type":"text/markdown","content":"# 初中地理公开课完整输出模板\n\n## 一、课程基本信息\n年级、版本册次、章/节/课时、课型时长、主导模式、核心素养侧重、教材与地图证据、待核项。\n\n## 二、单元与区域定位\n内容主线、空间尺度、前后工具/区域方法依赖、本课功能。\n\n## 三、地理事象与资料分析\n列表：区域边界/尺度、地图图表、空间分布、自然与人文要素、时间过程、区域差异联系、人地反馈、资料年份来源、不能推出的结论。\n\n## 四、学情与地图能力起点\n已有经验、定位/比例尺/图例、描述、图表、综合因果、典型误读至少2项、差异；给2—4分钟诊断和分支。\n\n## 五、核心增长与目标—任务—证据\n一句增长；2—4项目标、核心任务、个体证据、成功标准和时点。\n\n## 六、重难点与地理证据链\n`定位尺度→描述格局→比较→多因素解释→验证→人地权衡→迁移`；写结论边界。\n\n## 七、主导模式与课堂主线\n模式理由、驱动问题、最终地图/解释/方案成果、自主指导边界、删除的形式活动。\n\n## 八、地图数据、工具与实践安全\n每份资料标题、来源、年份、范围、比例尺/投影；工具、版权、标准地图审查；户外路线、人员、天气交通、隐私与取消条件。\n\n## 九、原始读图与分析工具\n给空白标图、分布描述框、区域比较表、因果链、方案矩阵；不预填结论。\n\n## 十、教学流程\n每环含功能、区域/尺度、资料、核心任务、个体先行、合作必要性；表格写教师话语、学生地理实践、地图/数据要求、产出、典型误读、反馈；补素养落点、结论边界、过渡与时间。总时长闭合。\n\n## 十一、板书与地图成果\n动态呈现位置尺度、格局、要素联系、人地反馈、证据和方案；不得随意简化国家版图。\n\n## 十二、量规、差异化与作业\n至少四维3级：地图工具、空间描述、区域证据、综合解释、尺度边界、人地权衡、实践质量。写分层支架和带安全来源的迁移作业。\n\n## 十三、反思与核验\n3类证据、3个风险、资料冲突/例外、地图与数据待核、下一课连接。\n\n## 硬约束\n- 仅目录不能生成完整教案；无地图/图表不得伪造读图任务。\n- 不把景观图片当分布证据，不把相关当因果，不把自然条件写成唯一决定。\n- 不混尺度、年份和区域边界；方案必须写取舍与代价。\n- 中国地图必须来源权威、边界完整、符合审图要求。","content_hash":"396b6ef32dc3e0e0621b4aec9a25bea9c94692b02a85ff53c9121ae6cc920332","load_mode":"always","max_chars":953,"sort_order":20,"metadata":{"source_package":"geography-public-lesson-design","runtime_role":"discipline_reference"}},{"path":"references/excellent-example-junior.md","name":"初中地理优秀教案样例","description":"依据课标评价机制重构的山区铁路选线规划决策示范","media_type":"text/markdown","content":"# 初中地理优秀教案参考样例\n\n> 依据《义务教育地理课程标准（2022年版）》“山区铁路选线”评价样题机制原创重构。正式使用须补入经核验的等高线图、候选线路、聚落、地质/水文、生态、成本和技术资料；本样例不提供或暗示虚构地图答案。\n\n## 一、课程基本信息\n\n| 字段 | 内容 |\n|---|---|\n| 学段 | 初中地理 |\n| 课题 | 山区铁路如何选线 |\n| 课型/时长 | 区域规划与多约束决策，40分钟 |\n| 核心素养 | 区域认知、综合思维、人地协调观、地理实践力 |\n| 主导模式 | 规划决策 |\n| 教材定位 | 依据实际教材章/节和活动页补充 |\n| 证据门禁 | 无真实底图、图层元数据和区域资料，不实施完整教案 |\n\n## 二、单元与区域定位\n\n本课应承接等高线判读、地形对交通影响等知识，进一步把地图技能用于区域规划。区域范围、行政归属、空间尺度和线路用途必须由实际资料确定。本课独特功能是让学生认识：自然地理提供约束，技术、经济、聚落服务和生态保护共同影响交通布局，方案不是地形单因素的自动答案。\n\n## 三、地理事象与资料分析\n\n### 资料元数据卡（每份均须填写）\n\n| 编号 | 图层 | 标题 | 范围/尺度 | 方向/坐标 | 比例尺或空间分辨率 | 投影 | 年份/更新时间 | 来源/许可/审图号 | 图例 | 本课用途与局限 |\n|---|---|---|---|---|---|---|---|---|---|---|\n| G1 | 等高线地形 | 待核 |  |  |  |  |  |  |  |  |\n| G2 | 聚落/站点需求 | 待核 |  |  |  |  |  |  |  |  |\n| G3 | 洪水/滑坡等风险 | 待核 |  |  |  |  |  |  |  | 静态风险图不能证明某时刻必然发生灾害 |\n| G4 | 生态敏感区 | 待核 |  |  |  |  |  |  |  |  |\n| G5 | 工程成本/技术 | 待核 |  |  |  |  |  |  |  |  |\n\n学生要分别描述：地形起伏与陡缓、河谷/山脊位置；聚落集中与疏散、距候选线关系；风险区范围和等级；生态敏感区形态与线路交叠；工程困难与成本差异。空间重叠只是相关证据，是否形成风险/代价还须用地质、水文、工程或生态机制资料解释。\n\n## 四、学情与地图能力起点\n\n| 维度 | 一般性预判 | 诊断/响应 |\n|---|---|---|\n| 等高线 | 能认山地，坡度判断不稳定 | 标两段等距线路并比较等高线疏密 |\n| 空间描述 | 易写“这里危险/人多”，无位置范围 | 使用位置—范围—疏密—延伸—例外框 |\n| 因果 | 认为图层重叠即因果 | 要求补机制资料和条件词 |\n| 决策 | “最短最好”或“生态最重要”单指标 | 比较至少两案、四类约束 |\n| 尺度 | 局部坡度结论外推全线 | 每次结论写适用线段/区域 |\n\n诊断3分钟：每人在底图画初线并写首要理由。只写距离者补地形层；只写地形者补服务对象与生态约束；无法定位者先完成图例和方位检查。\n\n## 五、核心增长与目标—任务—证据\n\n**核心增长**：学生从凭最短距离或单一地形印象选线，走向在明确尺度下逐层描述空间事实、解释作用机制，并用多约束证据比较和修订线路。\n\n| 目标 | 核心任务 | 个体证据 | 成功标准 |\n|---|---|---|---|\n| 规范判读资料 | 核对元数据并描述各图层 | 个人图层描述卡 | 事实描述含位置、范围/疏密、与线路关系及例外 |\n| 解释地形影响 | 等高线—坡度—工程机制链 | 因果链 | 不倒置因果，明确具体线段 |\n| 比较选线方案 | A/B指标矩阵 | 个人矩阵 | 至少四类约束，评分有图号和位置证据 |\n| 修订并权衡 | 规划听证后修线 | 初线/修线与说明 | 写收益、代价、风险、不确定性和补偿/规避 |\n\n## 六、重难点与地理证据链\n\n- **重点**：从多图层提取同尺度空间证据并形成规划判断。\n- **难点**：从重叠/邻近关系走向有机制、有条件的因果解释。\n- **证据链**：元数据核验→定位尺度→逐层空间描述→跨层比较→机制资料验证→候选方案评分→权重取舍→修线→新条件迁移。\n- **边界**：课堂资料只能支持教学情境中的初步方案，不能替代真实工程勘察和审批。\n\n## 七、主导模式与课堂主线\n\n驱动问题：在安全、服务、成本和生态约束下，哪条线路更合理？最终成果为带证据编号的个人修订线路和说明。小组听证用于质询权重，不能取代个人读图。不存在预设唯一答案；证据不足的指标可以写“不知道/待勘察”。\n\n## 八、地图数据、工具与实践安全\n\n- 所有图层须同一基准范围或提供可靠配准方法；比例尺、投影、分辨率不同则不可直接透明叠加。\n- 中国区域底图使用自然资源部标准地图服务或权威教材图，保持边界完整并按规定标注审图号。\n- 工具可为透明图层纸或经核准GIS；数字工具不自动生成结论。\n- 本课为课堂规划模拟，无户外行动。若扩展实地调查，另写路线、交通、天气、人员、通讯、隐私、危险点与取消条件。\n\n## 九、原始读图与分析工具\n\n### 逐层空间描述表\n\n| 图层 | 直接可读事实：位置/范围/疏密/延伸/例外 | 与A/B线的空间关系 | 可能影响机制 | 还需什么证据 | 暂不评分原因/评分 |\n|---|---|---|---|---|---|\n\n### 方案矩阵\n\n| 指标 | A线证据（图号+位置） | B线证据（图号+位置） | 机制与条件 | 权重理由 | 不确定性 |\n|---|---|---|---|---|---|\n| 坡度/工程安全 |  |  |  |  |  |\n| 服务聚落 |  |  |  |  |  |\n| 风险 |  |  |  |  |  |\n| 生态 |  |  |  |  |  |\n| 成本/技术 |  |  |  |  |  |\n\n必须先完成逐层事实描述，才允许把该层转入方案矩阵。看见重叠但缺机制资料时只能标“可能相关/待核”，不能直接扣分。\n\n## 十、教学流程\n\n### 环节1｜初选冲突（3分钟）\n\n每人核对底图基本元数据，画初选线并写首要理由，保留为前测。\n\n### 环节2｜地形层：先描述再解释（7分钟）\n\n学生独立标陡缓、河谷/山脊、候选线跨越位置，使用“某线段等高线___，说明坡度___”。再解释地形—坡度—盘曲/桥隧—安全和成本。只说“山多所以弯”者须补具体位置和机制。\n\n### 环节3｜三类图层逐层取证（8分钟）\n\n分批给G2—G4。每层严格执行：元数据检查→个人事实描述→与A/B线比较→提出可能机制→读取补充说明验证→写边界→再评分。反馈分支：\n\n- 只写“重叠所以危险”者改为“在哪一段重叠；风险图表示概率/等级还是事件；何种过程可能影响线路”；\n- 用旧年份人口解释当前需求者标时间错配；\n- 把单点聚落代表全区域者补范围与例外。\n\n### 环节4｜工程成本层与个人矩阵（7分钟）\n\n加入G5技术/成本资料。每人完成A/B矩阵，至少引用四个图层和具体位置。资料缺项必须写“不知道”，不得凭常识编数值。\n\n### 环节5｜规划听证（8分钟）\n\n小组扮演运营、安全、居民、生态和财政视角，互相质询证据、权重与不确定性。教师追问 `这是一张图上的空间相关，还是已有机制证据？结论适用于哪一段？`。允许不同方案，但不允许无图号的断言。\n\n### 环节6｜个人修线（4分钟）\n\n每人用第二编码修线并写：`因G__在___位置显示___，且机制资料说明___，我把___改为___；收益___，代价___，仍需勘察___。`\n\n### 环节7｜迁移出口（3分钟）\n\n判断高速铁路为何可能更取直，必须同时说明技术与经济条件改变、桥隧代价和生态风险，不能只写“科技发达”。\n\n**总时间：3+7+8+7+8+4+3=40分钟。**\n\n## 十一、板书与地图成果\n\n```text\n选线 = 空间证据 + 机制 + 多约束权衡\n元数据 → 描述格局 → 比较关系 → 解释机制 → 标边界 → 评分\n地形 / 聚落 / 风险 / 生态 / 成本技术\n相关 ≠ 因果     静态风险图 ≠ 必然发生\n初线 → 质询 → 修线（收益、代价、不确定性）\n```\n\n板书保留学生初线与修线，所有判断旁标G编号。\n\n## 十二、评价量规、差异化与作业\n\n| 维度 | 3级 | 2级 | 1级 |\n|---|---|---|---|\n| 地图规范 | 元数据和尺度使用准确 | 少量遗漏不影响判断 | 图例/尺度误读 |\n| 空间描述 | 位置、范围/疏密、关系、例外完整 | 有位置和主要格局 | 只有评价词 |\n| 综合解释 | 多因素、有机制和条件 | 多因素但机制较弱 | 单因或相关当因果 |\n| 规划权衡 | 比较两案并写代价/不确定性 | 有方案和部分取舍 | 唯一答案无取舍 |\n| 修订 | 根据具体证据改变线路/论证 | 有修改但证据弱 | 未使用反馈 |\n\n视觉困难学生用放大/高对比图和文字坐标；色觉困难图层兼用纹理/编号；空间起点弱者用分区网格；提前达标者改变指标权重做敏感性分析。作业：对另一幅经核地图比较两线（15分钟），注明来源与“不足以判断”项。\n\n## 十三、教学反思与核验清单\n\n- 收集初线、逐层描述表、矩阵、修线四类证据。\n- 风险：讨论脱图、图层错配、教师暗定权重；分别强制图号位置引用、课前配准核查、公开权重理由。\n- 核验每图标题、范围、方向/坐标、比例尺/分辨率、投影、年份、来源、许可/审图号、图例与用途边界。\n- 下一课把“描述—机制—边界”方法迁移到聚落、农业或灾害区域问题。","content_hash":"3e0502d01ea6b0a90a5d9f2afd3c47cc2b31018a713506e21bfef2bebd684328","load_mode":"always","max_chars":4060,"sort_order":30,"metadata":{"source_package":"geography-public-lesson-design","runtime_role":"discipline_reference","stages":["初中"]}},{"path":"references/sources-and-boundaries.md","name":"地理 Skill 来源与边界","description":"课标、新教材、目录证据、标准地图、数据与实践边界","media_type":"text/markdown","content":"# 地理 Skill 来源与边界\n\n- 本地《义务教育地理课程标准（2022年版）》及附录样题/实践案例；官方入口：[义务教育课程方案和课程标准](https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html)。\n- [人教版义务教育地理（七～八年级）新教材介绍](https://www.pep.com.cn/xw/zt/hd/12/xjcjs/cz/202409/t20240918_1995544.html)：用于核心素养、活动/思与学/随图思考和地图编排依据。\n- [2024年部级精品课名单](https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/A06/202506/W020250624684887950733.pdf)：确认地图、地球运动、气候、河流、区域发展等代表课题，不提供可复制流程。\n\n当前项目地理教材仅官方目录摘要，完整生成必须补教材正文和实际地图资料。地图、统计、遥感、新闻须记录来源、年份、范围和尺度；时效性数据应联网核验。中国地图使用自然资源部标准地图服务或权威教材图并按要求标注审图号，不裁切、变形或遗漏。户外调查遵守天气、交通、场地、隐私与未成年人安全规定。样例是课标机制的原创重构，不代表真实工程建议。","content_hash":"2602f680b886355f1c1d9d3854938d96895ec6a7f210c6fb51f29ac058180ad6","load_mode":"always","max_chars":576,"sort_order":50,"metadata":{"source_package":"geography-public-lesson-design","runtime_role":"discipline_reference"}},{"path":"agents/openai.yaml","name":"OpenAI Skill 界面配置","description":"源包界面元数据，不进入生成上下文","media_type":"application/yaml","content":"interface:\n  display_name: \"地理公开课设计\"\n  short_description: \"依据地图资料、区域比较和人地关系生成完整公开课教案\"\n  default_prompt: \"请依据准确教材和地图资料，为初中地理公开课生成可实施、可评价的完整教案。\"","content_hash":"baf4e4960bcb806b48f5757b95f21aa58916ce72932df096dc42b187ab012537","load_mode":"evaluation_only","max_chars":142,"sort_order":60,"metadata":{"source_package":"geography-public-lesson-design","runtime_role":"evaluation_only"}}],"skill_description":"完整初中地理公开课设计 Skill：以地图资料、空间尺度、区域比较和人地系统组织证据，生成实践与规划决策完整的教案。","match_criteria":{"subjects":["地理"],"lesson_types":["公开课"]}}$subjectskill$::jsonb;
  v_skill_id uuid;
  v_version_id uuid;
begin
  select id into v_skill_id
  from public.hai_work_skills
  where slug = v_payload->>'skill_slug';

  if v_skill_id is null then
    raise exception 'Work Skill 不存在：%', v_payload->>'skill_slug';
  end if;

  if exists (
    select 1 from public.hai_work_skill_versions
    where skill_id = v_skill_id
      and version_label = v_payload->>'version_label'
      and status in ('published', 'archived')
  ) then
    raise exception '同名学科 Work Skill 版本已冻结：%', v_payload->>'version_label';
  end if;

  update public.hai_work_skill_versions
  set status = 'archived', updated_at = now()
  where skill_id = v_skill_id and status = 'published';

  insert into public.hai_work_skill_versions (
    skill_id, version_label, status, prompt_template, default_prompt_template,
    input_contract, output_contract, snapshot_hash, source_metadata, published_at
  ) values (
    v_skill_id,
    v_payload->>'version_label',
    'draft',
    v_payload->>'instructions',
    v_payload->>'instructions',
    v_payload->'input_contract',
    v_payload->'output_contract',
    v_payload->>'snapshot_hash',
    v_payload->'source_metadata',
    null
  )
  on conflict (skill_id, version_label) do update set
    status = 'draft',
    prompt_template = excluded.prompt_template,
    default_prompt_template = excluded.default_prompt_template,
    input_contract = excluded.input_contract,
    output_contract = excluded.output_contract,
    snapshot_hash = excluded.snapshot_hash,
    source_metadata = excluded.source_metadata,
    published_at = null,
    updated_at = now()
  returning id into v_version_id;

  delete from public.hai_work_skill_references where skill_version_id = v_version_id;

  insert into public.hai_work_skill_references (
    skill_version_id, path, name, description, media_type, content,
    content_hash, load_mode, max_chars, sort_order, metadata
  )
  select
    v_version_id, item.path, item.name, item.description, item.media_type,
    item.content, item.content_hash, item.load_mode, item.max_chars,
    item.sort_order, item.metadata
  from jsonb_to_recordset(v_payload->'references') as item(
    path text, name text, description text, media_type text, content text,
    content_hash text, load_mode text, max_chars integer, sort_order integer,
    metadata jsonb
  );

  update public.hai_work_skill_versions
  set status = 'published', published_at = now(), updated_at = now()
  where id = v_version_id;

  update public.hai_work_skills
  set name = '地理公开课设计 Skill',
      description = v_payload->>'skill_description',
      match_criteria = v_payload->'match_criteria',
      is_fallback = false,
      is_enabled = true,
      updated_at = now()
  where id = v_skill_id;

  perform public.hai_recompute_work_module_enabled('subject-lesson-design');
end;
$$;

commit;
