type TokenFn = () => Promise<string | null>;
type SignOutFn = () => Promise<void>;

let getTokenImpl: TokenFn | null = null;
let signOutImpl: SignOutFn | null = null;

export function setClerkSessionHandlers(getToken: TokenFn, signOut: SignOutFn) {
  getTokenImpl = getToken;
  signOutImpl = signOut;
}

export async function getClerkSessionToken(): Promise<string | null> {
  if (!getTokenImpl) return null;
  return getTokenImpl();
}

export async function clerkSignOut(): Promise<void> {
  await signOutImpl?.();
}
