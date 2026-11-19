# Independent proposal authorship

These fixed inputs exercise conditional application behavior across 60 public shopping conversations. They are independently authored synthetic provider proposals. They are not genuine OpenAI responses or proof of model understanding.

Only public-conversations.json and intent-actions-source.ts supplied task data. The author read the installed poteto-mode runtime and the Model the Domain, Prove It Works, Build the Lever, and Unslop skills. No private milestone, baseline, judge, oracle, application output, imported parser, credential, or ledger was consulted. No application or paid request was run. No GitHub operation occurred.

The parent owns the evaluation playbook. This bounded authoring task used a turn-indexed proposal table. The throughput checkpoint was to author literal-span operations once, calculate UTF-16 offsets mechanically, and validate all records in one artifact-only pass. No accepted preference state or evaluation result was supplied to the author.

Each turn records its unchanged literal message, disposition, and proposed actions. Limitations remain outside the strict proposal object. Money uses the amount, minimum, and currency shape visible in the permitted source. Unsupported EUR, GBP, AUD, and JPY amounts retain currency null. Their original currency remains in the exact source text. This does not authorize conversion or accepting an arbitrary supported currency. Approximate budget wording does not authorize inventing a tolerance.

Three remove-criterion actions carry symbolic IDs. Their symbolicTargets entries identify the prior literal criterion wording. An adapter may resolve these only to a unique actual prior criterion ID. A missing or ambiguous match remains an unbound proposal. The adapter cannot add expected state, invent an ID, or rewrite a failed proposal to pass validation.

The criterion strength follows public meaning. Essential specifications and explicit necessities remain hard even when their wording lacks a lexical cue accepted by a reducer. Rather avoid expensive consumables remains flexible because the wording expresses preference. The resulting transport or reducer rejection is a conditional application observation, not an excuse to alter the tape.

Held-evidence comparisons, explanation requests, and source questions use acknowledge. This disposition does not provide their requested answer. The contract has no operation that can generate these answers, confirm cancellation, open a source, or change a presentation control. Each relevant turn records the limitation. Descriptive corrections also expose the absence of a replacement-description operation. In the manual-grinder correction, the exact replacement span is elliptical and cannot manufacture a combined description absent from that turn.

Model the Domain changed the artifact structure to turn-local operations and separate symbolic bindings instead of whole-state snapshots. Prove It Works changed completion evidence to direct checks of the saved JSON and its exact spans. Build the Lever changed the repeatable validation into the script below. Unslop kept these notes explicit about what the artifact can establish.

The following check validates the saved artifact only. It does not run the application, execute the imported schema or reducer, grade product behavior, or establish usefulness. It verifies input hashes, case and turn coverage, action fields, UTF-16 source containment, supported draft currency values, and symbolic target provenance.

```python
import hashlib
import json
from pathlib import Path

root = Path('/Users/josiahwong/Documents/research-shopping-evals/artifacts/product-evals/v5-design')
raw = json.loads((root / 'public-conversations.json').read_text())
artifact_path = root / 'intent-proposals.json'
artifact = json.loads(artifact_path.read_text())
conversations = artifact['conversations']
assert len(conversations) == 60
assert len({case['id'] for case in conversations}) == 60
assert [case['id'] for case in conversations] == [case['id'] for case in raw]
assert sum(len(case['turns']) for case in conversations) == 140
for name, digest in artifact['provenance']['inputs'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest
fields = {
    'start-request': {'kind', 'source'},
    'refine-description': {'kind', 'source'},
    'budget': {'kind', 'source', 'operation', 'draft'},
    'add-criterion': {'kind', 'source', 'strength'},
    'remove-criterion': {'kind', 'source', 'id'},
    'remove-budget': {'kind', 'source', 'bound'},
    'set-region': {'kind', 'source', 'value'},
}
action_count = 0
binding_count = 0
for source_case, case in zip(raw, conversations):
    assert len(source_case['turns']) == len(case['turns'])
    prior_criterion_sources = []
    for index, (message, turn) in enumerate(zip(source_case['turns'], case['turns'])):
        assert turn['turnIndex'] == index
        assert turn['message'] == message
        proposal = turn['proposal']
        assert set(proposal) == {'disposition', 'actions'}
        assert proposal['disposition'] in {'research', 'acknowledge', 'feedback', 'clarify-description'}
        actions = proposal['actions']
        assert len(actions) <= 16
        action_count += len(actions)
        symbolic = {entry['actionIndex']: entry['targetWording'] for entry in turn.get('symbolicTargets', [])}
        binding_count += len(symbolic)
        assert len(symbolic) == len(turn.get('symbolicTargets', []))
        for action_index, action in enumerate(actions):
            assert set(action) == fields[action['kind']]
            span = action['source']
            assert set(span) == {'start', 'end', 'text'}
            assert isinstance(span['start'], int) and isinstance(span['end'], int)
            assert 0 <= span['start'] < span['end']
            assert 0 < len(span['text'].encode('utf-16-le')) // 2 <= 2000
            encoded = message.encode('utf-16-le')
            assert encoded[span['start'] * 2:span['end'] * 2].decode('utf-16-le') == span['text']
            if action['kind'] == 'budget':
                assert action['operation'] in {'replace-range', 'set-maximum', 'clarify'}
                draft = action['draft']
                assert set(draft) == {'amount', 'minimum', 'currency'}
                assert draft['currency'] in {None, 'SGD', 'USD'}
                for amount in [draft['amount'], draft['minimum']]:
                    assert amount is None or isinstance(amount, (int, float)) and amount >= 0
                if action['operation'] == 'set-maximum':
                    assert draft['minimum'] is None
            elif action['kind'] == 'add-criterion':
                assert action['strength'] in {'hard', 'flexible'}
            elif action['kind'] == 'remove-criterion':
                assert len(action['id']) <= 40
                assert action_index in symbolic
                assert action['id'].startswith('@symbolic-')
                assert symbolic[action_index] in prior_criterion_sources
            elif action['kind'] == 'remove-budget':
                assert action['bound'] in {'all', 'minimum'}
            elif action['kind'] == 'set-region':
                assert action['value'] in {'SG', 'US'}
        for action_index in symbolic:
            assert actions[action_index]['kind'] == 'remove-criterion'
        prior_criterion_sources.extend(action['source']['text'] for action in actions if action['kind'] == 'add-criterion')
assert action_count == 229
assert binding_count == 3
print(json.dumps({'cases': 60, 'turns': 140, 'actions': action_count, 'symbolic_targets': binding_count, 'sha256': hashlib.sha256(artifact_path.read_bytes()).hexdigest()}))
```
