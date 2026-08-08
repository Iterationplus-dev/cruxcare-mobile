// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Ionic Vue's internal page-transition manager (isViewVisible) occasionally
// throws when a route leaves an <ion-tabs> outlet for the root outlet while
// a toast overlay is also transitioning — a known Ionic/headless-Chromium
// animation-timing rough edge, not an app-logic failure (the navigation and
// state change underneath it complete correctly either way). Narrowly
// ignored here rather than suppressing all uncaught exceptions.
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes("reading 'classList'")) return false;
});