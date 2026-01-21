export type Values = {
  validationPattern: string
  validationMessage: string
}

export const valuesDefault: Readonly<Values> = Object.freeze({
  validationPattern: "^ABC-\\d+-DEF$",
  validationMessage: "Field must match the pattern ABC-<number>-DEF",
})
