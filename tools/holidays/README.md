# 全国法定节日日期

依据国务院令第 795 号（2025 年 1 月 1 日施行）：
https://www.gov.cn/zhengce/content/202411/content_6986380.htm

覆盖全体公民的七类法定节日：元旦 1 月 1 日；春节除夕至正月初三；清明当日；劳动节 5 月 1–2 日；端午农历五月初五；中秋农历八月十五；国庆 10 月 1–3 日。倒计时不预测每年的调休、周末连休或补班；部分人群、地区的专属节日不纳入全民倒计时。

`lunar.js` 来自 MIT 许可的 `lunar-javascript@1.7.7`，仅在开发时用于生成农历和清明日期，生产浏览器读取本地 `holidays.json`，不加载日历库或访问第三方接口。

- 包来源：https://registry.npmjs.org/lunar-javascript/-/lunar-javascript-1.7.7.tgz
- 包 SHA-256：`d1359ab9ca4913d1db3978a42ddfc290eb8ea9de54ce043f5b1f718ff71eea36`
- 许可证：同目录 `LICENSE`。

在项目根目录重建：`node tools/holidays/build-calendar.cjs`。

生成范围 2025–2100 年，结束日期为北京时间的次日零点（不含）。页面按开始时间排序，显示最近节日；节日期间显示结束倒计时，结束后切换到下一项。同日或重叠的节日同时展示名称，跨年无需人工切换。如法定安排发生变化，更新生成器、重建 JSON 并提升 home.jsp 中 JSON 的缓存版本。
