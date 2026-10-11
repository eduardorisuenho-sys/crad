const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Id de 15 caracteres [a-z0-9], no formato aceito pelo PocketBase. Gerado no aparelho. */
export function gerarId(): string {
  const bytes = new Uint8Array(15);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let id = '';
  // 252 é o maior múltiplo de 36 abaixo de 256: descarta o viés do módulo.
  for (let i = 0; i < bytes.length; i++) id += ALFABETO[bytes[i] % 252 % 36];
  return id;
}

export function idValido(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9]{15}$/.test(id);
}
