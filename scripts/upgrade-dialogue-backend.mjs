// Run against an authorized local export of chat v28. Never commit that export.
import {readFileSync,writeFileSync} from 'node:fs';
export function upgradeDialogueBackend(source) {
 const replacements=[
  ["const {error:saveErr}=await admin.from('advisor_ai_messages').insert({case_id:caseId,user_id:userId,role:'assistant',content:answer.slice(0,80000)});", "let savedAnswer;try{savedAnswer=prepareAssistantAnswer(answer)}catch{return json({error:'Ответ превышает допустимый размер сохранения. Неполный документ не сохранён; обратись к администратору.',code:'answer_too_long',retryable:false},502)}\n const {error:saveErr}=await admin.from('advisor_ai_messages').insert({case_id:caseId,user_id:userId,role:'assistant',content:savedAnswer});"],
  ["return json({error:'Answer was not saved; check logs'},500)", "return json({error:'AI подготовил ответ, но сохранить его в историю не удалось. Повтор запускает новую генерацию и может расходовать API-баланс. Сообщи администратору.',code:'answer_not_saved',retryable:false},500)"],
  ["if(resp.status===429)return json({error:'AI временно ограничил частоту запросов. Попробуй позже.'},429);", "const providerError=providerFailure(resp.status,result);\n  if(providerError){const {status,...detail}=providerError;return json(detail,status)}"],
  ["return json({service:'Advisor AI Workspace'", "const configuredModel=Deno.env.get('ADVISOR_CHAT_MODEL')||DIALOGUE_MODEL;\n  const modelAvailable=new URL(req.url).searchParams.get('model_check')==='1'?await probeDialogueModel(configuredModel,Deno.env.get('OPENAI_API_KEY')):undefined;\n  return json({configured_model:configuredModel,model_available:modelAvailable,service:'Advisor AI Workspace'"],
  [" const body={model:Deno.env.get('OPENAI_MODEL')||'gpt-5-mini',instructions:documentInstructions+' '+conciseAnswerPolicy+' '+answerLengthPolicy,input:aiInput,max_output_tokens:6500,reasoning:{effort:'low'},store:false};\n if(marketQuestion)body.tools=[{type:'web_search',search_context_size:'medium'}];",
   " const body={instructions:documentInstructions+' '+conciseAnswerPolicy+' '+answerLengthPolicy,input:aiInput,store:false};\n const needsCurrentSources=configureDialogue(body,{question:latestQuestion,kind:c.kind,marketQuestion,model:Deno.env.get('ADVISOR_CHAT_MODEL')||''});"],
  [" let resp,result={},toolFailureNote='';", " let resp,result={},toolFailureNote='',modelReserveNote='';"],
  ["  ({response:resp,payload:result}=await ask(body));", "  const initial=await askWithReserve(body,ask);\n  ({response:resp,payload:result}=initial);\n  if(initial.reserved)modelReserveNote='Основная модель недоступна этому API-аккаунту; ответ подготовлен резервной моделью '+body.model+'.\\n\\n';"],
  ["web_search_called:webCalls.length", "web_search_called:successfulSearches(result.output||[]),model:body.model,model_reserved:Boolean(modelReserveNote)"],
  ["const marketWithoutSearch=marketQuestion&&toolsStatus.web_search_called===0;", "const marketWithoutSearch=needsCurrentSources&&toolsStatus.web_search_called===0;"],
  ["const answer=verificationNote+", "const answer=modelReserveNote+verificationNote+"]
 ];
 for(const [from,to] of replacements){if(source.split(from).length!==2)throw new Error('Unexpected backend baseline: '+from.slice(0,80));source=source.replace(from,to)}
 return "import {configureDialogue,askWithReserve,successfulSearches,probeDialogueModel,DIALOGUE_MODEL,providerFailure,prepareAssistantAnswer} from './dialogue-policy.mjs';\n"+source;
}
if(process.argv[1]===new URL(import.meta.url).pathname){if(!process.argv[2]||!process.argv[3])throw new Error('Usage: node scripts/upgrade-dialogue-backend.mjs input.ts output.ts');writeFileSync(process.argv[3],upgradeDialogueBackend(readFileSync(process.argv[2],'utf8')))}
