declare namespace App {
  interface Locals {
    nativeRewrite?: { path: string; method: string }
    user: {
      email: string
      name: string
      picture: string | null
      member: import("./lib/db").Member | null
      admin: boolean
    } | null
  }
}
