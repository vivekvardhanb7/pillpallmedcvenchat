import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const intakeCode = await readFile(resolve(here, 'src/intake-and-safety-engine.js'), 'utf8');
const catalogCode = await readFile(resolve(here, 'src/catalog-decision.js'), 'utf8');

const workflow = {
  name: 'PILLPAL MedAssist - Supabase Safety Chat MVP',
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'pillpal-chat-turn',
        responseMode: 'responseNode',
        // n8n rejects requests with a non-matching x-pillpal-auth header before
        // the workflow runs, so no $env lookup is needed inside the workflow.
        authentication: 'headerAuth',
        options: {},
      },
      id: randomUUID(),
      name: 'Chat Turn Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.1,
      position: [-760, 100],
      webhookId: randomUUID(),
      credentials: {
        httpHeaderAuth: {
          id: 'sKKZe6liXy5SsWfl',
          name: 'Backend Service Auth Medtest',
        },
      },
    },
    {
      parameters: { jsCode: intakeCode },
      id: randomUUID(),
      name: 'Intake and Safety Engine',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [-520, 100],
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: '',
            typeValidation: 'strict',
            version: 2,
          },
          combinator: 'and',
          conditions: [
            {
              id: randomUUID(),
              leftValue: '={{ $json.needs_catalog === true }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
        },
        options: {},
      },
      id: randomUUID(),
      name: 'Needs Approved Product Catalog?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [-280, 100],
    },
    {
      parameters: {
        operation: 'getAll',
        tableId: 'recommendable_product_pathways',
        returnAll: true,
        orderBy: 'display_priority.asc,product_name.asc',
        filterType: 'none',
      },
      id: randomUUID(),
      name: 'Load Approved Products from Supabase',
      type: 'n8n-nodes-base.supabase',
      typeVersion: 1,
      position: [-20, 0],
      alwaysOutputData: true,
      onError: 'continueRegularOutput',
      retryOnFail: true,
      maxTries: 2,
      waitBetweenTries: 1000,
      credentials: {
        supabaseApi: {
          id: '2LlBAYIF92xtHmcJ',
          name: 'PILLPALL CHATBOT',
        },
      },
    },
    {
      parameters: { jsCode: catalogCode },
      id: randomUUID(),
      name: 'Deterministic Product Matcher',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [240, 0],
    },
    {
      parameters: {
        respondWith: 'json',
        responseBody: '={{ $json }}',
        options: {
          responseCode: 200,
          responseHeaders: {
            entries: [
              { name: 'Access-Control-Allow-Origin', value: '*' },
              { name: 'Cache-Control', value: 'no-store' },
              { name: 'X-Content-Type-Options', value: 'nosniff' },
            ],
          },
        },
      },
      id: randomUUID(),
      name: 'Return Touchscreen Response',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.4,
      position: [520, 100],
    },
    {
      // Logging happens after the customer already has their response, and the
      // insert node below uses onError: continueRegularOutput, so a Supabase
      // outage can never take the touchscreen down.
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: '',
            typeValidation: 'strict',
            version: 2,
          },
          combinator: 'and',
          conditions: [
            {
              id: randomUUID(),
              leftValue: '={{ $json.outcome !== "MORE_INFORMATION" }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
        },
        options: {},
      },
      id: randomUUID(),
      name: 'Assessment Finished?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [760, 100],
    },
    {
      parameters: {
        operation: 'insert',
        tableId: 'kiosk_outcome_log',
        columns: {
          mappingMode: 'defineBelow',
          value: {
            session_key: '={{ $json.session_id }}',
            country_code: '={{ ($json.state && $json.state.country_code) || "MA" }}',
            language_code: '={{ ($json.state && $json.state.language_code) || "en" }}',
            pathway_code: '={{ ($json.state && $json.state.pathway_code) || "none" }}',
            age_band: '={{ !$json.state || typeof $json.state.age_years !== "number" ? "unknown" : $json.state.age_years < 18 ? "under_18" : $json.state.age_years <= 30 ? "18_30" : $json.state.age_years <= 45 ? "31_45" : $json.state.age_years <= 65 ? "46_65" : "over_65" }}',
            duration_code: '={{ ($json.state && $json.state.duration_code) || "unknown" }}',
            severity: '={{ ($json.state && $json.state.severity) || "unknown" }}',
            outcome: '={{ $json.outcome }}',
            reasons: '={{ ($json.reason_codes || []).join(",") }}',
            turns: '={{ $json.turns || 0 }}',
            elapsed_ms: '={{ $json.elapsed_ms || 0 }}',
          },
          matchingColumns: [],
          schema: [],
        },
        options: {},
      },
      id: randomUUID(),
      name: 'Log Outcome (anonymised)',
      type: 'n8n-nodes-base.supabase',
      typeVersion: 1,
      position: [1000, 40],
      onError: 'continueRegularOutput',
      credentials: {
        supabaseApi: {
          id: '2LlBAYIF92xtHmcJ',
          name: 'PILLPALL CHATBOT',
        },
      },
    },
  ],
  pinData: {},
  connections: {
    'Chat Turn Webhook': {
      main: [[{ node: 'Intake and Safety Engine', type: 'main', index: 0 }]],
    },
    'Intake and Safety Engine': {
      main: [[{ node: 'Needs Approved Product Catalog?', type: 'main', index: 0 }]],
    },
    'Needs Approved Product Catalog?': {
      main: [
        [{ node: 'Load Approved Products from Supabase', type: 'main', index: 0 }],
        [{ node: 'Return Touchscreen Response', type: 'main', index: 0 }],
      ],
    },
    'Load Approved Products from Supabase': {
      main: [[{ node: 'Deterministic Product Matcher', type: 'main', index: 0 }]],
    },
    'Deterministic Product Matcher': {
      main: [[{ node: 'Return Touchscreen Response', type: 'main', index: 0 }]],
    },
    'Return Touchscreen Response': {
      main: [[{ node: 'Assessment Finished?', type: 'main', index: 0 }]],
    },
    'Assessment Finished?': {
      main: [
        [{ node: 'Log Outcome (anonymised)', type: 'main', index: 0 }],
        [],
      ],
    },
  },
  active: false,
  settings: {
    executionOrder: 'v1',
    binaryMode: 'separate',
  },
  versionId: randomUUID(),
  meta: { templateCredsSetupCompleted: true },
  nodeGroups: [],
  id: randomUUID().replaceAll('-', '').slice(0, 16),
  tags: [],
};

const outputPath = resolve(here, 'workflows/PILLPAL_MedAssist_Supabase_Safety_Chat_MVP.json');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(outputPath);

