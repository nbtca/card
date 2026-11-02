declare namespace App {
  interface Locals {
    user: import("./lib/session").User | null
  }
}
