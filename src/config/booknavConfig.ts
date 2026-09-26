import type { BooknavGroup, BooknavPageConfig } from "../types/booknavConfig";

export const booknavPageConfig: BooknavPageConfig = {
	title: "工具导航",
	description: "收录值得留在手边的工具网站，按分类翻阅与查找。",
	favicon: {
		enabled: false,
		api: "https://a.favicon.im/{domain}",
	},
};

export const booknavConfig: BooknavGroup[] = [
	{
		id: "ai-assistants",
		name: "AI 助手",
		icon: "material-symbols:smart-toy-outline-rounded",
		desc: "对话、写作与编程辅助",
		weight: 40,
		items: [
			{
				title: "DeepSeek",
				url: "https://www.deepseek.com/",
				desc: "探索 DeepSeek 的 AI 对话服务与模型资源。",
				icon: "/images/tool-icons/deepseek.ico",
				weight: 20,
			},
			{
				title: "ChatGPT",
				url: "https://chatgpt.com/",
				desc: "通过 AI 对话辅助写作、学习与编程。",
				icon: "/images/tool-icons/chatgpt.webp",
				weight: 10,
			},
		],
	},
	{
		id: "models-local-ai",
		name: "模型与本地 AI",
		icon: "material-symbols:hub-outline-rounded",
		desc: "开放模型与本地运行工具",
		weight: 30,
		items: [
			{
				title: "Hugging Face",
				url: "https://huggingface.co/",
				desc: "发现与分享机器学习模型、数据集和应用。",
				icon: "/images/tool-icons/hugging-face.svg",
				weight: 20,
			},
			{
				title: "Ollama",
				url: "https://ollama.com/",
				desc: "在本地运行和管理开放语言模型。",
				icon: "/images/tool-icons/ollama.png",
				weight: 10,
			},
		],
	},
	{
		id: "development-open-source",
		name: "开发与开源",
		icon: "material-symbols:code-rounded",
		desc: "代码托管与开源协作",
		weight: 20,
		items: [
			{
				title: "GitHub",
				url: "https://github.com/",
				desc: "托管代码、参与开源项目与协作开发。",
				icon: "/images/tool-icons/github.png",
				weight: 10,
			},
		],
	},
	{
		id: "algorithms-practice",
		name: "算法与练习",
		icon: "material-symbols:school-outline-rounded",
		desc: "算法训练与在线评测",
		weight: 10,
		items: [
			{
				title: "力扣（LeetCode 中文官网）",
				url: "https://leetcode.cn/",
				desc: "通过中文题库练习算法与准备编程面试。",
				icon: "/images/tool-icons/leetcode.ico",
				weight: 20,
			},
			{
				title: "洛谷",
				url: "https://www.luogu.com.cn/",
				desc: "学习算法、练习编程题并参与竞赛。",
				icon: "/images/tool-icons/luogu.ico",
				weight: 10,
			},
		],
	},
];
