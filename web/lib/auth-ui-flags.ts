/** OAuth buttons: set NEXT_PUBLIC_AUTH_GOOGLE=true when Google OAuth env is configured on the server. */
export function authGoogleButtonEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true";
}

export function authGithubButtonEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_GITHUB === "true";
}
