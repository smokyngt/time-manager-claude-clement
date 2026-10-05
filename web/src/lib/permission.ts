type ScopeList = readonly string[]

export class Permission {
  static readonly scope = {
    /**
     * @route client.lib.permission.scope.all
     * @param {readonly string[]} scopes
     * @param {readonly string[]} required
     * @returns {boolean}
     */
    all(scopes: ScopeList, required: ScopeList): boolean {
      return required.every((scope) => scopes.includes(scope))
    },

    /**
     * @route client.lib.permission.scope.any
     * @param {readonly string[]} scopes
     * @param {readonly string[]} required
     * @returns {boolean}
     */
    any(scopes: ScopeList, required: ScopeList): boolean {
      return required.some((scope) => scopes.includes(scope))
    },
  }
}
