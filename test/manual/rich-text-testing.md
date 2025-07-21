# Manual Testing Guide for QuillJS Integration

## Overview
This document provides a checklist of manual tests to verify the QuillJS rich text editor integration is working correctly across the application.

## Test Environment Setup
1. Start the application with `npm run dev`
2. Login as an instructor: `instructor@test.com` / `instructor123`

## Test Cases

### 1. Assignment Creation Form

#### Rich Text Editor UI
- [ ] Navigate to the create assignment page 
- [ ] Verify the rich text editor toolbar appears for the description field
- [ ] Verify the rich text editor toolbar appears for the instructor-only context field

#### Basic Formatting
- [ ] Create an assignment with the following tests in the description:
  - [ ] Bold text (select text, click bold button)
  - [ ] Italic text (select text, click italic button)
  - [ ] Bullet points (click bullet list button, type items)
  - [ ] Numbered list (click numbered list button, type items)
  - [ ] Headings (select text, apply heading)
  - [ ] Links (select text, click link button, add URL)
- [ ] Submit the assignment form
- [ ] Verify the formatted text appears correctly on the success screen

#### Instructor-Only Context
- [ ] Add formatted text in the instructor-only context field
- [ ] Verify it appears correctly on the success screen with proper formatting
- [ ] Verify the amber-colored styling is maintained

### 2. Rubric Builder

#### Criterion Description
- [ ] Add a new criterion to the rubric
- [ ] Use rich text formatting in the description field
- [ ] Verify the formatting is maintained when the criterion is added to the list
- [ ] Verify the text renders correctly in the criterion cards

### 3. Submission Page

#### Notes Field
- [ ] Navigate to a shareable assignment link
- [ ] Add formatted text in the notes field
- [ ] Submit the assignment
- [ ] Verify the formatted notes are stored correctly

#### Assignment Description Display
- [ ] Verify the assignment description shows the rich text formatting correctly
- [ ] Test with various formatting including links, lists, and code blocks

### 4. Cross-Device Testing
- [ ] Test the rich text editor on a mobile device/viewport
- [ ] Verify the toolbar adapts to smaller screens
- [ ] Verify text formatting works on mobile

### 5. Accessibility Testing
- [ ] Verify the rich text editor is keyboard accessible
- [ ] Test keyboard navigation through toolbar buttons
- [ ] Verify screen readers can interpret the formatted content

### 6. Edge Cases
- [ ] Test pasting formatted content from external sources
- [ ] Test with large amounts of text
- [ ] Test with special characters and emojis

## Security Testing
- [ ] Try entering potentially harmful HTML in the editor (`<script>alert('test')</script>`)
- [ ] Verify the script tags are sanitized when the content is displayed

## Testing QuillJS with Gemini AI

### AI Feedback Generation
- [ ] Create an assignment with rich text formatting in the description
- [ ] Submit a solution to the assignment
- [ ] Verify the AI correctly interprets the formatted instructions
- [ ] Check that the AI references specific parts of the formatted text in feedback

### AI Processing of Instructor Context
- [ ] Create an assignment with rich formatting in the instructor-only context
- [ ] Submit a solution as a student
- [ ] Verify the AI uses the context to guide feedback (without revealing it)
- [ ] Check that the AI can properly interpret formatting in its analysis

## Results Documentation
For each test case, document:
- Pass/Fail status
- Any unexpected behavior
- Browser/device information
- Screenshots of issues if applicable