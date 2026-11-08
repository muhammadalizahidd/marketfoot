/** PostgREST returns a to-one join as an object; legacy untyped callers may infer an array. */
export function one<T>(value:T|T[]|null|undefined):T|null { return Array.isArray(value)?value[0]??null:value??null; }
