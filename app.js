const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const examples={
 basic:`// Try changing the values and compile again
let price = 10;
let quantity = 3;
let total = price * quantity + 2;
print(total);
print("CodeVision is running!");`,
 if:`let score = 82;
if (score >= 50) {
  print("Passed");
} else {
  print("Try again");
}`,
 loop:`let count = 3;
while (count > 0) {
  print(count);
  count = count - 1;
}
print("Liftoff!");`,
 error:`let total = 5 + ;
print(missingValue);`
};
let last=null,activePhase="tokens";
const source=$("#source"),lineNumbers=$("#lineNumbers");
function syncLines(){let n=source.value.split("\n").length;lineNumbers.textContent=Array.from({length:n},(_,i)=>i+1).join("\n");let before=source.value.slice(0,source.selectionStart).split("\n");$("#cursorInfo").textContent=`Ln ${before.length}, Col ${before[before.length-1].length+1}  •  Spaces: 2`}
source.addEventListener("input",syncLines);source.addEventListener("click",syncLines);source.addEventListener("keyup",syncLines);
source.addEventListener("keydown",e=>{if(e.key==="Tab"){e.preventDefault();let a=source.selectionStart,b=source.selectionEnd;source.setRangeText("  ",a,b,"end");syncLines()}if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();runCompile()}});
$("#exampleSelect").addEventListener("change",e=>{source.value=examples[e.target.value];syncLines()});
$("#compileBtn").addEventListener("click",runCompile);$("#analyzeBtn").addEventListener("click",runCompile);
$("#resetBtn").addEventListener("click",()=>{source.value=examples.basic;$("#exampleSelect").value="basic";last=null;$("#consoleOutput").textContent="Your program output will appear here after a successful compile.";$("#runStatus").textContent="Waiting";$("#tokenMetric").innerHTML='— <span>run compiler</span>';$("#errorMetric").innerHTML='— <span>no run yet</span>';$("#optMetric").innerHTML='Ready <span>constant folding</span>';$$(".phase-card").forEach(c=>{c.classList.remove("done","selected");c.querySelector(".phase-state").textContent="NOT RUN"});$("#inspectorTitle").textContent="Your compiler artifacts will show here";$("#inspectorContent").className="inspector-content empty-state";$("#inspectorContent").textContent="Compile a program, then select a phase card to inspect its output.";syncLines();toast("Workbench reset")});
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(t){let el=$("#toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2300)}
function runCompile(){last=CodeVisionCompiler.compile(source.value);$("#tokenMetric").innerHTML=`${last.tokens.length} <span>lexemes</span>`;let errors=last.lexErrors.length+last.parseErrors.length+last.semanticErrors.length+(last.runtimeError?1:0);$("#errorMetric").innerHTML=`${errors} <span>${errors===1?"issue":"issues"}</span>`;$("#optMetric").innerHTML=`${last.optimizations} <span>IR lines reduced</span>`;$("#consoleOutput").textContent=last.ok? (last.output.join("\n")||"(Program completed with no output)") : (errors? "Compilation did not complete.\n"+allErrors().map(e=>`Line ${e.line||"?"}: ${e.message}`).join("\n"):"No output.");$("#runStatus").textContent=last.ok?"Completed":errors?"Blocked":"No output";$$(".phase-card").forEach(c=>{c.classList.toggle("done",last.tokens.length>0||last.ast!==null);c.querySelector(".phase-state").textContent=last.ast?"READY":last.tokens.length?"PARTIAL":"CHECK"});showPhase(activePhase);toast(last.ok?"Compile successful":"Analysis finished — inspect diagnostics")}
function allErrors(){return [...(last?.lexErrors||[]),...(last?.parseErrors||[]),...(last?.semanticErrors||[]),...(last?.runtimeError?[{message:last.runtimeError}]:[])]}
function renderTable(headers,rows){if(!rows.length)return '<div class="empty-state">No entries for this phase.</div>';return `<div style="overflow:auto"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`}
function diagnostics(){let e=allErrors();if(!e.length)return '<div class="diagnostic ok">✓ No lexical, syntax, or semantic errors detected.</div>';return e.map(x=>`<div class="diagnostic error"><b>Line ${x.line||"?"}${x.col?`, column ${x.col}`:""}</b> — ${esc(x.message)}</div>`).join("")}
function showPhase(phase){activePhase=phase;$$(".phase-card").forEach(c=>c.classList.toggle("selected",c.dataset.phase===phase));let title="",html="";if(!last){title="Run the compiler first";html='<div class="empty-state">Compile a program to generate phase artifacts.</div>'}else switch(phase){
case"tokens":title="Lexical token stream";html=renderTable(["TYPE","LEXEME","LINE","COLUMN"],last.tokens.map(t=>[t.type,t.value,t.line,t.col]))+diagnostics();break;
case"ast":title="Abstract syntax tree";html=last.ast?`<pre class="tree">${esc(CodeVisionCompiler.pretty(last.ast))}</pre>`:diagnostics();break;
case"semantic":title="Semantic analysis & symbol table";html=diagnostics()+(last.symbols.length?'<h4>Symbols</h4><div class="symbol-list">'+last.symbols.map(s=>`<div class="symbol-item"><b>${esc(s.name)}</b><span>Type: ${esc(s.type)} · Line ${s.line}</span><span>Initial value: ${esc(s.value)}</span></div>`).join("")+'</div>':'<div class="empty-state">No symbols were collected.</div>');break;
case"tac":title="Three-address intermediate code";html=`<pre class="code-output">${esc(last.tac.join("\n")||"; no instructions generated")}</pre>`;break;
case"optimized":title="Optimized intermediate code";html=`<div class="diagnostic ${last.optimizations?"ok":"warn"}">${last.optimizations?`✓ Simplification reduced IR by ${last.optimizations} line(s).`:"No line-count reduction detected; expressions may still have been simplified."}</div><pre class="code-output">${esc(last.optimizedTac.join("\n")||"; no instructions generated")}</pre>`;break;
case"machine":title="Virtual machine instructions";html=`<pre class="code-output">${esc(last.machine.join("\n")||"; no instructions generated")}</pre><p class="note">These are educational stack-machine instructions, not native CPU machine code.</p>`;break}
$("#inspectorTitle").textContent=title;$("#inspectorContent").className="inspector-content";$("#inspectorContent").innerHTML=html}
$$(".phase-card").forEach(c=>c.addEventListener("click",()=>showPhase(c.dataset.phase)));
const views={editor:$("#editorView"),pipeline:$("#pipelineView"),learning:$("#learningView")};
$$(".nav-item").forEach(b=>b.addEventListener("click",()=>{let tab=b.dataset.tab;$$(".nav-item").forEach(x=>x.classList.toggle("active",x===b));Object.entries(views).forEach(([k,v])=>v.classList.toggle("hidden",k!==tab));$("#topContext").textContent=tab==="editor"?"CODE WORKBENCH":tab==="pipeline"?"COMPILER PIPELINE":"LEARNING STUDIO"}));
source.value=examples.basic;syncLines();
