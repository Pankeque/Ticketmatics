# Ticketmatics - Discord Ticket Bot

## Overview
Ticketmatics is a robust Discord ticket system that allows users to create support channels with a single button click. It features an administrative panel, ticket logging, and easy management for support teams.

## User Preferences
- Name: Ticketmatics
- Language: English

## Architecture
- **Framework**: Discord.js v14
- **Persistence**: In-memory for current session (can be upgraded to database)
- **UI**: Discord Buttons, Modals, and Select Menus for a seamless user experience
- **Branding**: Yellow (#FFFF00)

## Commands
- `/setup`: Deploys the ticket creation message in the current channel (Admin only).
