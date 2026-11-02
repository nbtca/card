declare namespace App {
  interface Locals {
    user: {
      email: string
      name: string
      picture: string | null
      member: import("./lib/db").Member | null
      admin: boolean
    } | null
  }
}
