/// <reference types="cypress" />

/** Types into the input whose <label> text matches — resilient to markup
 * changes since AppInput/AppSelect always pair label `for` with input `id`. */
Cypress.Commands.add('fillByLabel', (label: string, value: string) => {
  cy.contains('label', label)
    .invoke('attr', 'for')
    .then((id) => {
      cy.get(`#${id}`).clear().type(value);
    });
});

Cypress.Commands.add('loginAsDemo', () => {
  cy.visit('/auth/login');
  cy.fillByLabel('Username or email', 'demo@cruxcare.app');
  cy.fillByLabel('Password', 'Passw0rd!1');
  cy.contains('button', 'Log in').click();
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      fillByLabel(label: string, value: string): Chainable<void>;
      loginAsDemo(): Chainable<void>;
    }
  }
}

export {};
