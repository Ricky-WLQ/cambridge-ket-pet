// Single-source Simplified Chinese dictionary.
// Usage:
//   import { t } from "@/i18n/zh-CN";
//   <h1>{t.app.title}</h1>
//
// This file is the only place UI copy should live. Future multi-locale work
// (e.g. en-US) will clone the shape and swap via a resolver; keys are stable.

export const t = {
  app: {
    name: "剑桥 KET / PET",
    title: "剑桥 KET / PET 备考",
    tagline: "AI 生成仿真练习题，紧扣剑桥真题的题型、考点和难点",
    metaDescription:
      "面向中国 K-12 学生的剑桥英语 KET（A2 Key）与 PET（B1 Preliminary）备考平台，含教师监控与学习进度追踪。",
  },
  nav: {
    login: "登录",
    signup: "注册",
    signOut: "退出登录",
    myClasses: "我的班级",
    teacherPanel: "教师面板",
    applyTeacher: "申请教师",
    teacherBadge: "教师",
    backHome: "← 返回首页",
    history: "历史记录",
  },
  common: {
    loading: "加载中…",
    networkError: "网络错误，请重试",
  },
  auth: {
    signup: {
      title: "注册账号",
      subtitle: "开始你的剑桥 KET / PET 备考之旅",
      nameLabel: "姓名（可选）",
      namePlaceholder: "你的名字",
      emailLabel: "邮箱",
      passwordLabel: "密码",
      passwordPlaceholder: "至少 8 位",
      submit: "注册",
      submitting: "注册中…",
      hasAccount: "已有账号？",
      toLogin: "登录",
      failed: "注册失败",
      autoLoginFailed: "注册成功，但自动登录失败，请手动登录。",
    },
    login: {
      title: "登录",
      subtitle: "欢迎回到剑桥 KET / PET 备考",
      emailLabel: "邮箱",
      passwordLabel: "密码",
      submit: "登录",
      submitting: "登录中…",
      noAccount: "还没有账号？",
      toSignup: "注册",
      wrongCredentials: "邮箱或密码错误",
    },
    activate: {
      title: "教师激活",
      subtitle: "输入激活码以获得教师权限",
      codeLabel: "激活码",
      codePlaceholder: "TEACHER-XXXX-XXX",
      submit: "激活",
      submitting: "激活中…",
      success: "✓ 激活成功！你现在是教师身份",
      redirecting: "即将跳转首页…",
      failed: "激活失败",
    },
  },
  classes: {
    student: {
      title: "我加入的班级",
      empty: "你还没有加入任何班级。使用上方的邀请码加入。",
      teacherLabel: "教师：",
      joinedAt: "加入于",
    },
    join: {
      title: "加入班级",
      placeholder: "输入 8 位邀请码",
      submit: "加入",
      submitting: "加入中…",
      failed: "加入失败",
      successPrefix: "已加入",
    },
    teacher: {
      title: "我的班级",
      createButton: "+ 创建班级",
      empty: "你还没有创建任何班级",
      emptyCta: "创建第一个班级",
      inviteCodeLabel: "邀请码",
      studentsSuffix: "位学生",
      createdAt: "创建于",
    },
    new: {
      title: "创建班级",
      subtitle: "创建后，邀请码可用于学生加入",
      nameLabel: "班级名称",
      namePlaceholder: "例如：2026 春季 KET",
      examFocusLabel: "考试重点（可选）",
      examFocusAny: "不限（KET / PET 均可）",
      submit: "创建班级",
      submitting: "创建中…",
      createdSuccessPrefix: "✓ 班级",
      createdSuccessSuffix: "创建成功",
      shareCodeHint: "分享此邀请码给你的学生",
      toListButton: "查看全部班级",
      createAnotherButton: "再创建一个",
      toListLink: "← 返回班级列表",
      failed: "创建失败",
    },
  },
  portal: {
    ket: { label: "KET", sub: "剑桥 A2 Key" },
    pet: { label: "PET", sub: "剑桥 B1 Preliminary" },
    getStarted: "立即开始",
  },
} as const;

export type Dict = typeof t;
