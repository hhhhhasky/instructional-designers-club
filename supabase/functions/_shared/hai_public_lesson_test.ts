import { publicLessonReferences, publicLessonSubject, appendLessonReferences } from "./hai_public_lesson.ts";
import { initialWorkflow, parseWorkflowOutput, workflowPrompt } from "./hai_workflow.ts";
import type { WorkSkillCandidate, WorkSkillReference } from "./hai_work.ts";
function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
const ref = (path: string) => ({ path, content: path, max_chars: 1000 } as WorkSkillReference);
const skill = { version: { references: [ref('references/subjects/mathematics.md'), ref('references/boundaries/mathematics.md'), ref('references/templates/mathematics.md'), ref('references/templates/chinese.md'), ref('references/teaching-models.md')] } } as WorkSkillCandidate;
const choice = {id:'a',title:'说明算理',reason:'概念关系',approach:'解释依据'};
Deno.test('all new public lessons start at focus even with an old politics form preference',()=>{
 for (const subject of ['数学','道德与法治','语文']) assert(initialWorkflow('subject-lesson-design',{subject,teaching_mode:'案例式'},false,2)?.stage==='focus','focus skipped');
 assert(initialWorkflow('subject-lesson-design',{},true,2)===null,'revision restarted');
 assert(initialWorkflow('unit-learning-design',{},false,2)?.version===1,'unit changed');
});
Deno.test('public lesson references are exact and stage-specific, with missing references rejected',()=>{
 assert(publicLessonSubject('高中数学 B版')==='mathematics','math alias failed');
 assert(publicLessonReferences(skill,{subject:'数学'},'focus').length===2,'common refs missing');
 assert(publicLessonReferences(skill,{subject:'数学'},'result').every(r=>r.path==='references/templates/mathematics.md'),'other subject leaked');
 assert(publicLessonReferences(skill,{subject:'数学'},'mode')[0].path==='references/teaching-models.md','mode knowledge missing');
 let rejected=false;try {publicLessonReferences(skill,{subject:'历史'},'result')}catch{rejected=true}assert(rejected,'missing template accepted');
});
Deno.test('confirmed focus and mode are required in later phases and reach the final prompt',()=>{
 let rejected=0;
 for(const stage of ['mode','result'] as const)try{workflowPrompt({system:'',user:''},{version:2,revision:1,stage},'subject-lesson-design')}catch{rejected++}
 assert(rejected===2,'unconfirmed stage accepted');
 const prompt=workflowPrompt({system:'',user:''},{version:2,revision:3,stage:'result',selected_focus:choice,selected_mode:{...choice,title:'概念建构式'}},'subject-lesson-design');
 assert(prompt.user.includes('说明算理')&&prompt.user.includes('概念建构式'),'confirmed choices lost');
 assert(prompt.system.includes('不强制专属策略'),'strategy became mandatory');
 const refs=appendLessonReferences(prompt,{result:[ref('only-math-template')]},'result');
 assert(refs.user.includes('only-math-template'),'template not appended');
});
Deno.test('focus parsing keeps only candidate fields and cannot forge server confirmation',()=>{
 const parsed=parseWorkflowOutput(JSON.stringify({options:[choice],stage:'result',selected_focus:choice,revision:999}),'focus','subject-lesson-design');
 assert(Object.keys(parsed).join(',')==='options','untrusted fields escaped');
 assert(parsed.options?.length===1,'explicit single focus rejected');
 for(const data of [null,{options:[null]},{options:[choice,choice]}]){
  let rejected=false;try{parseWorkflowOutput(JSON.stringify(data),'focus','subject-lesson-design')}catch{rejected=true}assert(rejected,'invalid candidate accepted');
 }
});
