/**
 * 用户协议文本内容
 * 
 * @description 注册时显示的用户协议，与 UserAgreementModal.jsx 解耦
 * 修改协议内容只需编辑此文件，无需改动 UI 组件
 */

export const USER_AGREEMENT = {
  title: '用户协议',
  subtitle: '请仔细阅读以下协议内容',
  intro: '您点击"同意"或登录/使用本游戏，即表示同意本协议全部条款。',

  sections: [
    {
      title: '一、账户规则',
      items: [
        { text: '账户为用户方所有，享有使用权，可转让、售卖、共享。', highlight: false },
        { text: '您对账户安全负全责，因被盗、共享导致的损失由您自行承担。', highlight: false },
        { text: '您对账户ID保存负责，因丢失、遗忘导致的损失由您自行承担。', highlight: true },
      ],
    },
    {
      title: '二、行为规范',
      items: [
        { text: '严禁使用外挂、脚本、破解程序，严禁利用漏洞牟利。', highlight: false },
        { text: '严禁发布键政、违法、违规、色情、辱骂以及诈骗信息。', highlight: false },
        { text: '违者运营方有权禁言、封号、清空数据。并且实施法律手段。', highlight: true },
      ],
    },
    {
      title: '三、付费与服务',
      items: [
        { text: '游戏内虚拟货币、道具等不具备财产属性，仅限游戏内使用，不支持提现或退款。', highlight: false },
        { text: '运营方有权根据情况调整虚拟物品的产出、价格与内容，已付费项目不予以补偿。', highlight: false },
        { text: '运营方有权进行服务器维护、更新，不可抗力等导致的服务中断，不承担赔偿责任。', highlight: false },
      ],
    },
    {
      title: '四、免责与终止',
      items: [
        { text: '因您违规导致的损失，由您自行承担，若造成运营方损失，您需予以赔偿。', highlight: false },
        { text: '若账号连续90天未登录，运营方有权删除账号及所有数据，且不予以恢复。', highlight: false },
      ],
    },
    {
      title: '五、游戏申明',
      items: [
        { text: '本游戏历史人物，地理，仅作尽可能还原并结合游戏性，并非完全的历史考据游戏。', highlight: false },
        { text: '本游戏势力设定，综合参考史实和部分约定俗成的记述，一并糅合而成，请勿细究。', highlight: false },
      ],
    },
  ],

  footer: {
    brand: 'Notee.vip',
    copyright: 'Copyright © 2026',
  },
};
