# Zhang Lab 课题组网站

这是一个专业的学术实验室网站，用于展示Zhang Lab（张世成课题组）的研究工作和团队信息。

## 📁 网站结构

```
Lab_Website/
├── index.html              # 首页
├── css/
│   └── style.css          # 样式文件
├── js/
│   └── script.js          # JavaScript交互脚本
├── images/                # 图片文件夹
│   ├── Structure.png      # GPCR结构图
│   └── dreadd.png         # DREADD示意图
├── zhang/                 # 课题组负责人信息
│   ├── Photo.jpg          # 张老师照片
│   └── Infomation.docx    # 简历信息
├── Members/               # 成员照片
│   └── WeiTH-Photo.jpg    # 成员照片
└── pages/                 # 内页
    ├── research.html      # 研究方向
    ├── leader.html        # 课题组负责人
    ├── members.html       # 团队成员
    └── news.html          # 新闻动态
```

## 🚀 使用方法

### 方法1：直接打开（推荐）

直接双击 `index.html` 文件，或使用命令：

```bash
xdg-open /data/weitianhua/Desktop/Lab_Website/index.html
```

### 方法2：本地服务器

```bash
cd /data/weitianhua/Desktop/Lab_Website
python3 -m http.server 8000
```

然后在浏览器访问：http://localhost:8000

## ✨ 功能特点

1. **响应式设计** - 自适应各种屏幕尺寸（PC、平板、手机）
2. **白色主色调** - 简洁、专业的学术风格
3. **流畅动画** - 优雅的页面元素淡入效果
4. **图片展示** - GPCR和DREADD研究图片展示
5. **多页面架构** - 清晰的导航和页面跳转
6. **悬停效果** - 丰富的交互体验

## 📝 自定义内容

### 1. 更新课题组负责人信息

编辑 `pages/leader.html`，已经使用了真实信息：
- 姓名：张世成
- 职位：助理教授、研究员、博士生导师
- 邮箱：zhangshicheng@hsc.pku.edu.cn
- 电话：010-82805164
- 单位：北京大学药学院

### 2. 添加团队成员

编辑 `pages/members.html`，在对应的section中添加成员卡片。

当前已添加成员：
- 魏天华 (Wei Tianhua) - 博士研究生

成员照片请放置在 `Members/` 文件夹中。

### 3. 更新研究成果

编辑 `pages/leader.html` 和 `pages/research.html`，更新论文列表和研究成果。

### 4. 添加新闻动态

编辑 `pages/news.html`，添加最新的实验室新闻和动态。

### 5. 更换图片

- GPCR结构图：`images/Structure.png`
- DREADD示意图：`images/dreadd.png`
- 负责人照片：`zhang/Photo.jpg`
- 成员照片：`Members/[姓名]-Photo.jpg`

### 6. 修改样式

编辑 `css/style.css` 来自定义颜色、字体、间距等样式。

主要CSS变量：
```css
--primary-color: #2563eb;    /* 主色调 */
--secondary-color: #3b82f6;  /* 辅助色 */
--text-dark: #1f2937;         /* 深色文字 */
--text-muted: #6b7280;        /* 灰色文字 */
```

## 🎨 设计特色

### 首页 (index.html)
- 欢迎标语和实验室简介
- GPCR和DREADD研究图片展示
- 三大研究维度概览
- 最新动态预览
- 数据统计展示

### 研究方向 (research.html)
- 详细的研究方向介绍
- 三个研究维度的深入阐述
- 关键研究领域
- 研究方法学
- 合作与资助信息

### 课题组负责人 (leader.html)
- 张世成老师的详细简介
- 教育背景和工作经历
- 研究兴趣
- 荣誉与奖励
- 代表性论文
- 教学与指导

### 团队成员 (members.html)
- 按层级分类展示成员
  - 博士后研究员
  - 研究助理
  - 博士生
  - 硕士生
  - 本科生
- 每个成员包含照片、研究方向、联系方式
- 招生招聘信息

### 新闻动态 (news.html)
- 按时间倒序展示新闻
- 新闻分类标签
- 分页导航
- 邮件订阅功能

## 🔧 技术栈

- HTML5
- CSS3
- JavaScript (ES6+)
- Bootstrap 5.3.0
- Bootstrap Icons

## 📱 浏览器兼容性

- Chrome (推荐)
- Firefox
- Safari
- Edge
- 移动端浏览器

## 📧 联系方式

如需技术支持或有任何问题，请联系：
- 邮箱：zhangshicheng@hsc.pku.edu.cn
- 电话：010-82805164

## 📄 更新日志

### 2024-02-07
- 初始版本发布
- 添加张世成老师真实信息
- 添加魏天华成员信息
- 集成GPCR和DREADD研究图片
- 优化动画效果
- 增强视觉设计

---

**Zhang Lab - GPCR Neuropharmacology Research**

*北京大学药学院*
