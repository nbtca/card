declare namespace App {
  interface Locals {
    user: {
      email: string
      name: string
      member: import("./lib/db").Member | null
      admin: boolean
    } | null
  }
}
