import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {initialConversation} from '../../../src/domain/conversation';
import {reduceTurn} from '../../../src/domain/turn-reducer';
import {projectExaAnswer} from '../../../src/server/exa-research';
import {nativeMaterial} from '../../../tests/helpers/v2-material';
const intent=reduceTurn(initialConversation(),{phase:'prepare',operationId:randomUUID(),message:'a USB-C powerbank between SGD30 and40'}).state.intent;
const cases=[
 {name:'second-product-distinct-source-control',text:'Fixture Other Model B is a separate product.'},
 {name:'mixed-source-contradiction-short-variant',text:'Model A costs SGD 65 for one unit, tax included. Fixture Other Model B is a separate product.'},
 {name:'mixed-source-shipping-short-variant',text:'Model A requires SGD 15 shipping in addition to the displayed price. Fixture Other Model B is a separate product.'},
 {name:'mixed-source-contradiction-full-name',text:'Fixture Powerbank Model A costs SGD 65 for one unit, tax included. Fixture Other Model B is a separate product.'},
];
const proof=cases.map(c=>{const m=nativeMaterial(intent);const b=structuredClone(m.answer.products[0]);b.id='model-b';b.name='Fixture Other Model B';b.variant='Model B';b.price=null as any;b.identity.status='unknown';b.requestMatch.status='unknown';m.answer.products.push(b);m.citations.push({url:'https://manufacturer.com/other',title:'Fixture comparison',text:c.text,image:''});return {name:c.name,input:m,result:projectExaAnswer(m,intent)};});
writeFileSync('artifacts/fieldnote-v2/security/cross-source-probes.json',JSON.stringify({head:process.env.REVIEW_HEAD,proof},null,2));console.log(JSON.stringify(proof.map(({name,result})=>({name,result:result.status==='ready'?{choice:result.research.choice,price:result.research.products.find(p=>p.id==='model-a')?.price}:result})),null,2));
