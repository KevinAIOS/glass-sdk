import {registerApp} from "@aios/glass/background"
registerApp((session) => {
  session.actions.handle("about", () => ({
    purpose: "在授权后整理已有记录中的联系人、关系、谈话和约定。应用只读原始资料。",
  }))
})
