describe('Client onboarding -> first order (PRD 5.1)', () => {
  it('registers, verifies OTP, completes the health profile gate, and lands on Home', () => {
    cy.visit('/auth/welcome');
    cy.contains('Natural care, in one place');
    cy.contains('Skip').click();
    cy.contains('Create an account').click();

    cy.location('pathname').should('include', '/auth/register');
    cy.fillByLabel('First name', 'Amara');
    cy.fillByLabel('Last name', 'Okafor');
    cy.fillByLabel('Email', `amara.${Date.now()}@example.com`);
    cy.fillByLabel('Phone', '8031234567');
    cy.contains('label', 'How did you hear about CruxCare?')
      .invoke('attr', 'for')
      .then((id) => cy.get(`#${id}`).select('friends-family'));
    cy.fillByLabel('Password', 'Passw0rd!1');
    cy.fillByLabel('Confirm password', 'Passw0rd!1');
    cy.contains('Passwords match');
    cy.get('.cc-consent__box').check({ force: true });
    cy.contains('button', 'Create account').click();

    cy.location('pathname').should('include', '/auth/otp');
    cy.contains('Enter the 5-digit code');
    ['1', '2', '3', '4', '5'].forEach((_, i) => {
      cy.get(`input[aria-label="Digit ${i + 1} of 5"]`).type('123456'.charAt(i));
    });
    cy.contains('button', 'Verify').click();

    cy.location('pathname').should('include', '/onboarding/health-profile-gate');
    cy.contains('Account verified');
    cy.contains('button', 'Browse the shop first').click();

    cy.location('pathname').should('include', '/tabs/home');
    cy.contains('Wallet');
  });
});
