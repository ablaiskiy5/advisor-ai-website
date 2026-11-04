// Apply to an authorized export of the deployed chat function. Keep that export private.
export function removeDialogueVerificationBanner(source) {
 const block = /^ const marketWithoutSearch=.*;\r?\n const verificationNote=marketWithoutSearch\?.*;\r?\n/m;
 if (!block.test(source) || source.split('+verificationNote+').length !== 2) {
  throw new Error('Unexpected chat banner baseline');
 }
 const policyAnchor = 'input:aiInput,store:false};';
 if (source.split(policyAnchor).length !== 2) throw new Error('Unexpected chat policy baseline');
 const clientPolicy = [
  "const clientIdea=c.kind==='ideas'&&(String(c.prompt||'').startsWith('[advisor-workbench:ideas-client:v1]')||/для клиент|клиентск/i.test(latestQuestion));",
  "if(c.kind==='ideas')body.instructions+=' Не выдумывай вложения, скриншоты, графики, разметку TradingView, котировки, даты и источники. Ссылайся на визуальный материал только если он действительно есть во входных данных и использован. Уровни из текста называй указанными уровнями без домыслов об их происхождении.';",
  "if(clientIdea)body.instructions+=' Подготовь готовое к отправке сообщение клиенту: инструмент и тезис, конкретные аргументы, горизонт и существенный риск простыми словами. Не включай внутренние комментарии, служебные пояснения об инструментах, выдуманные ссылки на графики или типовые дисклеймеры. Если конкретная цена или уровень не подтверждены и не даны пользователем, опусти их. Не обещай доходность.';"
 ].join('\n ');
 return source.replace(block, '').replace('+verificationNote+', '+')
  .replace("const answer=modelReserveNote+(toolFailureNote?", "const answer=(clientIdea?'':modelReserveNote)+(toolFailureNote&&!clientIdea?")
  .replace(policyAnchor, policyAnchor+'\n '+clientPolicy)
  .replace('const needsCurrentSources=configureDialogue(', 'configureDialogue(')
  .replace("+' '+answerLengthPolicy,input:aiInput", "+' '+answerLengthPolicy+' Не добавляй типовой дисклеймер о веб-поиске. Если конкретный факт не удалось подтвердить, обозначь пробел рядом с ним.',input:aiInput");
}
