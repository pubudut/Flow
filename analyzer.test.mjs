import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,edges,architecture,sample} from './analyzer.js';
test('nested branches reconnect to final calculation',()=>{
 const report=analyze(sample);
 assert.equal(report.flows.length,1);
 assert.equal(report.gaps.length,0);
 const flow=report.flows[0],links=edges(flow);
 const outer=flow.nodes.find(n=>n.label==='IF ORDER-TOTAL >= 100');
 const nested=flow.nodes.find(n=>n.label==='IF CUSTOMER-YEARS >= 5');
 const shipping=flow.nodes.find(n=>n.label==='MOVE 7.50 TO SHIPPING');
 assert.ok(links.some(([a,b,l])=>a===outer.id&&b===nested.id&&l==='Yes'));
 assert.ok(links.some(([a,b,l])=>a===outer.id&&b===shipping.id&&l==='No'));
 assert.equal(architecture(report,'modular').modules[0].name,'ORDER-PRICE capability');
});
test('unsupported control flow is flagged',()=>{
 const report=analyze([{name:'test.cbl',text:'PROCEDURE DIVISION.\nMAIN.\nPERFORM OTHER\nGOBACK.'}],'free');
 assert.equal(report.flows[0].uncertain,true);
 assert.equal(report.gaps.length,1);
});
test('non COBOL sources are inventoried',()=>{
 const report=analyze([{name:'test.rpgle',text:'anything'}]);
 assert.equal(report.flows.length,0);
 assert.equal(report.gaps.length,1);
});
test('architecture preserves program operations and exposes coupling',()=>{
 const source=name=>({name:name+'.cbl',text:`IDENTIFICATION DIVISION.
PROGRAM-ID. ${name}.
DATA DIVISION.
01 TOTAL PIC 9(5)V99.
COPY COMMON-RECORD.
PROCEDURE DIVISION.
LOAD-ORDER.
EXEC SQL
SELECT TOTAL FROM ORDERS
END-EXEC
CALL "TAX"
PERFORM PRICE-ORDER
PRICE-ORDER.
COMPUTE TOTAL = TOTAL * 1.10
EXEC SQL COMMIT END-EXEC
GOBACK.
`});
 const report=analyze([source('ORDERS'),source('TAX')],'free');
 const plan=architecture(report,'independent');
 assert.equal(plan.modules.length,1);
 assert.equal(plan.modules[0].operations.filter(o=>o.kind==='COMPUTE').length,2);
 assert.ok(plan.modules[0].adapters.some(a=>a.includes('Persistence')));
 assert.ok(plan.integration.some(i=>i.includes('repository program')));
 assert.ok(plan.coupling.some(c=>c.includes('COMMON-RECORD')));
 assert.ok(plan.decisions.some(d=>d.includes('Preserve observed transaction')));
 assert.ok(plan.modules[0].fields.some(f=>f.value.includes('TOTAL')));
});
