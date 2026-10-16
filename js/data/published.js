/**
 * 发布模式配置（由 tools/pack.mjs 生成，请勿手工编辑）
 *
 * mode:
 *   'normal'   —— 开发/管理员本机模式，管理员可登录后维护文件
 *   'readonly' —— 只读发布模式，发给普通用户
 *
 * allowAdminLogin:
 *   true  —— 只读模式下仍保留管理员登录入口（软性只读）
 *   false —— 彻底移除管理员能力（配合 --hard 打包物理剥离）
 */
window.XZU_PUBLISHED = {
  mode: 'normal',
  allowAdminLogin: true,
  packedAt: null,
  note: '本文件由 tools/pack.mjs 生成；未打包时为默认的开发模式'
};
