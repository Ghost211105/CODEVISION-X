/* CODEVISION X educational compiler engine. No eval() and no external compiler. */
(function(global){
"use strict";
const KEYWORDS=new Set(["let","if","else","while","print","true","false"]);
const TYPES={NUMBER:"number",STRING:"string",BOOLEAN:"boolean"};
class CompileError extends Error{constructor(message,line,col){super(message);this.line=line;this.col=col;}}
function lex(src){
 let tokens=[],errors=[],i=0,line=1,col=1;
 const add=(type,value,l=line,c=col)=>tokens.push({type,value,line:l,col:c});
 const advance=()=>{let ch=src[i++];if(ch==="\n"){line++;col=1}else col++;return ch};
 while(i<src.length){
  let ch=src[i];if(/\s/.test(ch)){advance();continue}
  if(ch==="/"&&src[i+1]==="/"){while(i<src.length&&src[i]!=="\n")advance();continue}
  if(ch==="/"&&src[i+1]==="*"){let sl=line,sc=col;advance();advance();let closed=false;while(i<src.length){if(src[i]==="*"&&src[i+1]==="/"){advance();advance();closed=true;break}advance()}if(!closed)errors.push({message:"Unterminated block comment",line:sl,col:sc});continue}
  let l=line,c=col;
  if(/[A-Za-z_]/.test(ch)){let v="";while(i<src.length&&/[A-Za-z0-9_]/.test(src[i]))v+=advance();add(KEYWORDS.has(v)?"KEYWORD":"IDENT",v,l,c);continue}
  if(/[0-9]/.test(ch)){let v="";while(i<src.length&&/[0-9]/.test(src[i]))v+=advance();if(src[i]==="."&&/[0-9]/.test(src[i+1]||"")){v+=advance();while(i<src.length&&/[0-9]/.test(src[i]))v+=advance()}add("NUMBER",Number(v),l,c);continue}
  if(ch==='"'||ch==="'"){let q=advance(),v="",closed=false;while(i<src.length){if(src[i]===q){advance();closed=true;break}if(src[i]==="\n")break;if(src[i]==="\\"){advance();let e=advance();v+=({"n":"\n","t":"\t","r":"\r"}[e]??e)}else v+=advance()}if(!closed)errors.push({message:"Unterminated string literal",line:l,col:c});else add("STRING",v,l,c);continue}
  let two=src.slice(i,i+2);if(["==","!=","<=",">=","&&","||"].includes(two)){advance();advance();add("OP",two,l,c);continue}
  if("+-*/%<>=!".includes(ch)){advance();add("OP",ch,l,c);continue}
  if("(){};,".includes(ch)){advance();add("PUNCT",ch,l,c);continue}
  errors.push({message:`Unexpected character '${ch}'`,line:l,col:c});advance();
 }
 tokens.push({type:"EOF",value:"EOF",line,col});return {tokens,errors};
}
class Parser{
 constructor(tokens){this.t=tokens;this.i=0}
 cur(){return this.t[this.i]} check(v){return this.cur().value===v} match(v){if(this.check(v)){this.i++;return true}return false}
 expect(v){if(!this.match(v))throw new CompileError(`Expected '${v}', found '${this.cur().value}'`,this.cur().line,this.cur().col);return this.t[this.i-1]}
 node(type,props={}){return {type,...props,line:this.cur().line}}
 parse(){let body=[];while(this.cur().type!=="EOF")body.push(this.statement());return {type:"Program",body,line:1}}
 statement(){
  if(this.match("let")){let name=this.cur();if(name.type!=="IDENT")throw new CompileError("Expected variable name after 'let'",name.line,name.col);this.i++;this.expect("=");let init=this.expression();this.expect(";");return {type:"Let",name:name.value,init,line:name.line}}
  if(this.match("print")){let l=this.t[this.i-1].line;this.expect("(");let value=this.expression();this.expect(")");this.expect(";");return {type:"Print",value,line:l}}
  if(this.match("if")){let l=this.t[this.i-1].line;this.expect("(");let test=this.expression();this.expect(")");let then=this.block();let otherwise=null;if(this.match("else"))otherwise=this.block();return {type:"If",test,then,otherwise,line:l}}
  if(this.match("while")){let l=this.t[this.i-1].line;this.expect("(");let test=this.expression();this.expect(")");return {type:"While",test,body:this.block(),line:l}}
  if(this.check("{"))return this.block();
  if(this.cur().type==="IDENT"){let name=this.cur();this.i++;this.expect("=");let value=this.expression();this.expect(";");return {type:"Assign",name:name.value,value,line:name.line}}
  let t=this.cur();throw new CompileError(`Unexpected '${t.value}' at start of statement`,t.line,t.col)
 }
 block(){this.expect("{");let body=[];while(!this.check("}")&&this.cur().type!=="EOF")body.push(this.statement());this.expect("}");return {type:"Block",body}}
 expression(){return this.binary(0)}
 binary(min){let left=this.unary();const prec={"||":1,"&&":2,"==":3,"!=":3,"<":4,">":4,"<=":4,">=":4,"+":5,"-":5,"*":6,"/":6,"%":6};while(this.cur().type==="OP"&&prec[this.cur().value]>=min){let op=this.cur().value,p=prec[op];this.i++;let right=this.binary(p+1);left={type:"Binary",op,left,right,line:left.line}}return left}
 unary(){if(this.match("!")||this.match("-")||this.match("+")){let op=this.t[this.i-1].value;return {type:"Unary",op,arg:this.unary(),line:this.t[this.i-1].line}}return this.primary()}
 primary(){let t=this.cur();if(t.type==="NUMBER"||t.type==="STRING"){this.i++;return {type:"Literal",value:t.value,valueType:t.type==="NUMBER"?"number":"string",line:t.line}}
 if(this.match("true")||this.match("false"))return {type:"Literal",value:t.value==="true",valueType:"boolean",line:t.line};
 if(t.type==="IDENT"){this.i++;return {type:"Identifier",name:t.value,line:t.line}}
 if(this.match("(")){let e=this.expression();this.expect(")");return e}
 throw new CompileError(`Expected expression, found '${t.value}'`,t.line,t.col)
 }
}
function typeOf(v){return v===null?"null":Array.isArray(v)?"array":typeof v}
function semantic(ast){
 let symbols=new Map(),errors=[];
 function expr(n){if(!n)return "void";if(n.type==="Literal")return n.valueType;if(n.type==="Identifier"){if(!symbols.has(n.name)){errors.push({message:`Variable '${n.name}' is not declared`,line:n.line,col:1});return "unknown"}return symbols.get(n.name).type}
 if(n.type==="Unary"){let t=expr(n.arg);if(n.op==="!"&&t!=="boolean"&&t!=="unknown")errors.push({message:"Operator ! expects a boolean value",line:n.line,col:1});if(n.op!=="!"&&t!=="number"&&t!=="unknown")errors.push({message:`Operator ${n.op} expects a number`,line:n.line,col:1});return n.op==="!"?"boolean":t}
 if(n.type==="Binary"){let a=expr(n.left),b=expr(n.right);if(["+","-","*","/","%"].includes(n.op)){if((a!=="number"&&a!=="unknown")||(b!=="number"&&b!=="unknown"))errors.push({message:`Operator ${n.op} expects numeric operands`,line:n.line,col:1});return "number"}if(["<",">","<=",">="].includes(n.op)){if(a!==b&&a!=="unknown"&&b!=="unknown")errors.push({message:"Comparison operands should have matching types",line:n.line,col:1});return "boolean"}if(["==","!="].includes(n.op)){if(a!==b&&a!=="unknown"&&b!=="unknown")errors.push({message:"Equality operands should have matching types",line:n.line,col:1});return "boolean"}return "boolean"}return "unknown"}
 function block(n){for(const s of n.body)stmt(s)}
 function stmt(n){if(n.type==="Let"){let t=expr(n.init);if(symbols.has(n.name))errors.push({message:`Variable '${n.name}' is already declared`,line:n.line,col:1});else symbols.set(n.name,{name:n.name,type:t,value:n.init.type==="Literal"?n.init.value:"—",line:n.line})}
 else if(n.type==="Assign"){let t=expr(n.value);if(!symbols.has(n.name))errors.push({message:`Cannot assign to undeclared variable '${n.name}'`,line:n.line,col:1});else{let old=symbols.get(n.name);if(old.type!==t&&t!=="unknown")errors.push({message:`Type mismatch: '${n.name}' is ${old.type}, assigned ${t}`,line:n.line,col:1});old.value=n.value.type==="Literal"?n.value.value:"—"}}
 else if(n.type==="Print")expr(n.value);else if(n.type==="Block")block(n);else if(n.type==="If"){let t=expr(n.test);if(t!=="boolean"&&t!=="unknown")errors.push({message:"if condition must be boolean",line:n.line,col:1});block(n.then);if(n.otherwise)block(n.otherwise)}
 else if(n.type==="While"){let t=expr(n.test);if(t!=="boolean"&&t!=="unknown")errors.push({message:"while condition must be boolean",line:n.line,col:1});block(n.body)}}
 block(ast);return {symbols:[...symbols.values()],errors};
}
function optimizeExpr(n){if(!n)return n;if(n.type==="Unary"){n.arg=optimizeExpr(n.arg);if(n.arg.type==="Literal"){try{return {type:"Literal",value:n.op==="-"?-n.arg.value:n.op==="+"?+n.arg.value:!n.arg.value,valueType:n.op==="!"?"boolean":"number",line:n.line}}catch(e){}}return n}
 if(n.type==="Binary"){n.left=optimizeExpr(n.left);n.right=optimizeExpr(n.right);if(n.left.type==="Literal"&&n.right.type==="Literal"){let a=n.left.value,b=n.right.value,v;try{switch(n.op){case"+":v=a+b;break;case"-":v=a-b;break;case"*":v=a*b;break;case"/":if(b===0)return n;v=a/b;break;case"%":v=a%b;break;case"==":v=a===b;break;case"!=":v=a!==b;break;case"<":v=a<b;break;case">":v=a>b;break;case"<=":v=a<=b;break;case">=":v=a>=b;break;case"&&":v=a&&b;break;case"||":v=a||b;break;default:return n}if(typeof v==="number"&&!Number.isFinite(v))return n;return {type:"Literal",value:v,valueType:typeOf(v),line:n.line}}catch(e){}}if(n.op==="+"&&n.right.type==="Literal"&&n.right.value===0)return n.left;if(n.op==="*"&&n.right.type==="Literal"&&n.right.value===1)return n.left;if(n.op==="*"&&n.right.type==="Literal"&&n.right.value===0)return {type:"Literal",value:0,valueType:"number",line:n.line};return n}return n}
function optimizeAst(ast){function stmt(s){if(s.init)s.init=optimizeExpr(s.init);if(s.value)s.value=optimizeExpr(s.value);if(s.test)s.test=optimizeExpr(s.test);if(s.body)for(const x of s.body)stmt(x);if(s.then)for(const x of s.then)stmt(x);if(s.otherwise)for(const x of s.otherwise)stmt(x)}for(const s of ast.body)stmt(s);return ast}
function genTac(ast){let out=[],temp=0,label=0;const t=()=>`t${++temp}`,l=()=>`L${++label}`;
 function ex(n){if(n.type==="Literal")return JSON.stringify(n.value);if(n.type==="Identifier")return n.name;if(n.type==="Unary"){let a=ex(n.arg),r=t();out.push(`${r} = ${n.op}${a}`);return r}if(n.type==="Binary"){let a=ex(n.left),b=ex(n.right),r=t();out.push(`${r} = ${a} ${n.op} ${b}`);return r}return "?"}
 function block(b){for(const s of b)st(s)}
 function st(s){if(s.type==="Let")out.push(`${s.name} = ${ex(s.init)}`);else if(s.type==="Assign")out.push(`${s.name} = ${ex(s.value)}`);else if(s.type==="Print")out.push(`PRINT ${ex(s.value)}`);else if(s.type==="Block")block(s.body);else if(s.type==="If"){let els=l(),end=l();out.push(`IF_FALSE ${ex(s.test)} GOTO ${els}`);block(s.then.body);if(s.otherwise){out.push(`GOTO ${end}`,`${els}:`);block(s.otherwise.body);out.push(`${end}:`)}else out.push(`${els}:`)}else if(s.type==="While"){let start=l(),end=l();out.push(`${start}:`,`IF_FALSE ${ex(s.test)} GOTO ${end}`);block(s.body.body);out.push(`GOTO ${start}`,`${end}:`)}}
 block(ast.body);return out}
function machine(ast){let out=[],temp=0,label=0;const t=()=>`R${++temp}`,l=()=>`M${++label}`;
 function ex(n){if(n.type==="Literal"){out.push(`PUSH ${JSON.stringify(n.value)}`);return}if(n.type==="Identifier"){out.push(`LOAD ${n.name}`);return}if(n.type==="Unary"){ex(n.arg);out.push(n.op==="-"?"NEG":n.op==="!"?"NOT":"POS");return}if(n.type==="Binary"){ex(n.left);ex(n.right);out.push(({"+":"ADD","-":"SUB","*":"MUL","/":"DIV","%":"MOD","==":"EQ","!=":"NE","<":"LT",">":"GT","<=":"LE",">=":"GE","&&":"AND","||":"OR"})[n.op]||"OP");}}
 function block(b){for(const s of b)st(s)}function st(s){if(s.type==="Let"){ex(s.init);out.push(`STORE ${s.name}`)}else if(s.type==="Assign"){ex(s.value);out.push(`STORE ${s.name}`)}else if(s.type==="Print"){ex(s.value);out.push("PRINT")}else if(s.type==="Block")block(s.body);else if(s.type==="If"){let e=l(),end=l();ex(s.test);out.push(`JUMP_IF_FALSE ${e}`);block(s.then.body);if(s.otherwise){out.push(`JUMP ${end}`,`${e}:`);block(s.otherwise.body);out.push(`${end}:`)}else out.push(`${e}:`)}else if(s.type==="While"){let start=l(),end=l();out.push(`${start}:`);ex(s.test);out.push(`JUMP_IF_FALSE ${end}`);block(s.body.body);out.push(`JUMP ${start}`,`${end}:`)}}block(ast.body);return out}
function execute(ast,maxSteps=10000){let env=Object.create(null),output=[],steps=0;function ex(n){if(++steps>maxSteps)throw Error("Execution stopped: step limit reached (possible infinite loop)");if(n.type==="Literal")return n.value;if(n.type==="Identifier"){if(!(n.name in env))throw Error(`Runtime error: '${n.name}' is not defined`);return env[n.name]}if(n.type==="Unary"){let v=ex(n.arg);return n.op==="-"?-v:n.op==="+"?+v:!v}if(n.type==="Binary"){let a=ex(n.left);if(n.op==="&&")return a&&ex(n.right);if(n.op==="||")return a||ex(n.right);let b=ex(n.right);switch(n.op){case"+":return a+b;case"-":return a-b;case"*":return a*b;case"/":if(b===0)throw Error("Runtime error: division by zero");return a/b;case"%":return a%b;case"==":return a===b;case"!=":return a!==b;case"<":return a<b;case">":return a>b;case"<=":return a<=b;case">=":return a>=b}}}
 function block(b){for(const s of b)st(s)}function st(s){if(++steps>maxSteps)throw Error("Execution stopped: step limit reached (possible infinite loop)");if(s.type==="Let")env[s.name]=ex(s.init);else if(s.type==="Assign")env[s.name]=ex(s.value);else if(s.type==="Print")output.push(String(ex(s.value)));else if(s.type==="Block")block(s.body);else if(s.type==="If"){if(ex(s.test))block(s.then.body);else if(s.otherwise)block(s.otherwise.body)}else if(s.type==="While"){let guard=0;while(ex(s.test)){block(s.body.body);if(++guard>maxSteps)throw Error("Execution stopped: loop limit reached")}}}block(ast.body);return output}
function pretty(n,depth=0){let p="  ".repeat(depth);if(n.type==="Program"||n.type==="Block")return `${p}${n.type}\n`+n.body.map(x=>pretty(x,depth+1)).join("");if(n.type==="Let")return `${p}Let ${n.name}\n${pretty(n.init,depth+1)}`;if(n.type==="Assign")return `${p}Assign ${n.name}\n${pretty(n.value,depth+1)}`;if(n.type==="Print")return `${p}Print\n${pretty(n.value,depth+1)}`;if(n.type==="If")return `${p}If\n${pretty(n.test,depth+1)}${pretty(n.then,depth+1)}${n.otherwise?pretty(n.otherwise,depth+1):""}`;if(n.type==="While")return `${p}While\n${pretty(n.test,depth+1)}${pretty(n.body,depth+1)}`;if(n.type==="Binary")return `${p}Binary(${n.op})\n${pretty(n.left,depth+1)}${pretty(n.right,depth+1)}`;if(n.type==="Unary")return `${p}Unary(${n.op})\n${pretty(n.arg,depth+1)}`;if(n.type==="Literal")return `${p}Literal(${JSON.stringify(n.value)} : ${n.valueType})\n`;if(n.type==="Identifier")return `${p}Identifier(${n.name})\n`;return p+n.type+"\n"}
function compile(src){let lx=lex(src),result={tokens:lx.tokens.filter(t=>t.type!=="EOF"),lexErrors:lx.errors,parseErrors:[],semanticErrors:[],symbols:[],ast:null,tac:[],optimizedTac:[],machine:[],output:[],optimizedAst:null,ok:false,optimizations:0};if(lx.errors.length)return result;try{result.ast=new Parser(lx.tokens).parse()}catch(e){result.parseErrors.push({message:e.message,line:e.line,col:e.col});return result}let sem=semantic(result.ast);result.symbols=sem.symbols;result.semanticErrors=sem.errors;result.tac=genTac(result.ast);result.optimizedAst=JSON.parse(JSON.stringify(result.ast));optimizeAst(result.optimizedAst);result.optimizedTac=genTac(result.optimizedAst);result.optimizations=Math.max(0,result.tac.length-result.optimizedTac.length);result.machine=machine(result.optimizedAst);if(!result.lexErrors.length&&!result.parseErrors.length&&!result.semanticErrors.length){try{result.output=execute(result.optimizedAst);result.ok=true}catch(e){result.runtimeError=e.message}}return result}
global.CodeVisionCompiler={compile,pretty};
})(window);