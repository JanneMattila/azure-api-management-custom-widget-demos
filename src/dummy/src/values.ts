export type Values = {
  label1: string
  label2: string
  placeholder: string
  actionUrl: string
}

export const valuesDefault: Readonly<Values> = Object.freeze({
  label1: "User",
  label2: "User token",
  placeholder: "This will be automatically filled after login",
  actionUrl: "https://httpbin.org/post",
})
