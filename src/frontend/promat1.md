# Clinical Ops Risk Monitor --- Frontend Dummy UI/UX Master Prompt

## IMPORTANT: FRONTEND ONLY

You are working ONLY on the frontend UI/UX of an existing project.

The goal is to create a complete, polished, Apple-inspired clinical
operations interface using **dummy/mock frontend data only**.

### Hard rules

1.  DO NOT modify the backend.
2.  DO NOT modify backend business logic.
3.  DO NOT create or modify backend APIs.
4.  DO NOT change API contracts.
5.  DO NOT add database changes.
6.  DO NOT change authentication.
7.  DO NOT change IBM watsonx.ai backend integration.
8.  DO NOT make real API calls for this UI task.
9.  DO NOT connect the dummy UI to the backend.
10. DO NOT modify files outside the frontend unless absolutely required
    for frontend build configuration.
11. All displayed data must live inside frontend mock-data files.
12. Every page must work using local dummy data.
13. Later, the team will replace the mock data with real backend data.
14. Keep the mock data isolated so it can be replaced easily.
15. The application must run independently as a frontend demo.

The existing backend must remain completely untouched.

------------------------------------------------------------------------

# 1. PROJECT

Application name:

**Clinical Ops**

Subtitle:

**Risk Monitor**

Purpose:

A clinical trial risk monitoring and protocol deviation detection
interface.

The UI represents a workflow for:

``` text
Protocol
    ↓
Protocol Rules
    ↓
Patient Data
    ↓
Deviation Detection
    ↓
Site Risk
    ↓
AI Explanation
    ↓
CAPA
    ↓
Human Approval
    ↓
Audit Trail
```

For this task, this workflow is visual/demo only.

Use dummy frontend data.

------------------------------------------------------------------------

# 2. CURRENT FRONTEND

The application currently runs at:

``` text
http://localhost:5174
```

The existing frontend has these sections:

-   Executive Dashboard
-   Site Ranking
-   Deviation Center
-   CAPA Management
-   Protocol Rules
-   Audit Trail

Create additional frontend-only detail routes where useful:

``` text
/dashboard
/sites
/sites/:siteId
/patients/:patientId
/deviations
/capa
/protocol
/audit
```

Do not modify backend routes.

------------------------------------------------------------------------

# 3. DUMMY DATA ARCHITECTURE

Create a dedicated frontend mock-data layer.

Recommended:

``` text
src/
  data/
    mockData.js
    mockSites.js
    mockPatients.js
    mockDeviations.js
    mockCapa.js
    mockProtocolRules.js
    mockAudit.js
```

Or, if the existing project has a different frontend structure:

``` text
src/data/
```

is preferred.

### IMPORTANT

All dummy values must be centralized.

Do NOT scatter hardcoded values throughout JSX.

Bad:

``` jsx
<div>75.6</div>
```

Good:

``` jsx
<div>{site.riskScore}</div>
```

where:

``` js
site.riskScore
```

comes from the frontend mock-data file.

This is important because later the team will replace:

``` text
mock data
```

with:

``` text
real backend data
```

without redesigning the UI.

------------------------------------------------------------------------

# 4. MOCK DATA CONTRACT

Create mock data that resembles the expected future backend objects.

Use clean structures.

Example:

``` js
const mockSites = [
  {
    id: "SITE-104",
    name: "City General Hospital",
    location: "Ahmedabad",
    patients: 10,
    deviations: 18,
    majorDeviations: 6,
    riskScore: 75.6,
    riskLevel: "HIGH",
    trend: "up",
    status: "Active"
  }
];
```

Patient:

``` js
{
  id: "P104-003",
  siteId: "SITE-104",
  status: "Active",
  currentVisit: "Visit 3",
  enrollmentDate: "2026-06-12"
}
```

Deviation:

``` js
{
  id: "DEV-0001",
  siteId: "SITE-104",
  patientId: "P104-003",
  visit: "Visit 3",
  ruleId: "DOSE-003",
  category: "Dosing",
  severity: "MAJOR",
  status: "OPEN",
  expected: "100 mg ± 5 mg",
  actual: "150 mg",
  protocolReference: "Section 5.2",
  detectedAt: "2 hours ago"
}
```

Protocol rule:

``` js
{
  id: "DOSE-003",
  category: "Dosing",
  name: "Dose Range Validation",
  condition: "Dose must remain within approved range",
  threshold: "100 mg ± 5 mg",
  severity: "MAJOR",
  protocolReference: "Section 5.2",
  status: "Approved"
}
```

CAPA:

``` js
{
  id: "CAPA-001",
  deviationId: "DEV-0001",
  siteId: "SITE-104",
  title: "Review dosing administration process",
  status: "DRAFT",
  priority: "HIGH",
  aiGenerated: true,
  rootCauseHypothesis: "...",
  immediateAction: "...",
  correctiveAction: "...",
  preventiveAction: "...",
  verificationMethod: "..."
}
```

Audit event:

``` js
{
  id: "AUDIT-001",
  timestamp: "14:32",
  actor: "JD",
  actorType: "USER",
  action: "CAPA_APPROVED",
  entity: "CAPA",
  entityId: "CAPA-001",
  details: "CAPA approved by clinical operations user."
}
```

------------------------------------------------------------------------

# 5. MOCK DATA REQUIREMENTS

Create enough dummy data to make every page look realistic.

Use:

-   10 sites
-   approximately 100 patients
-   40--50 deviations
-   10--20 protocol rules
-   5--10 CAPAs
-   15--30 audit events

The exact number is not important.

The important thing is that the UI must never look empty.

Use realistic but synthetic/de-identified clinical trial information.

Do not use real patient information.

------------------------------------------------------------------------

# 6. DESIGN DIRECTION

Create an Apple-inspired enterprise interface.

Do not copy Apple's proprietary interface.

Use these principles:

-   minimal
-   clean
-   precise
-   calm
-   premium
-   subtle
-   highly readable
-   excellent spacing
-   clear hierarchy
-   restrained colors
-   subtle borders
-   subtle shadows
-   smooth interactions

The application should feel like:

**A premium clinical operations command center.**

It should NOT look like:

-   generic admin dashboard
-   crypto dashboard
-   gaming dashboard
-   colorful SaaS template
-   generic chatbot
-   flashy AI website
-   excessive glassmorphism
-   neon interface

------------------------------------------------------------------------

# 7. COLOR SYSTEM

Use a restrained neutral design.

Background:

``` text
#F7F8FA
```

Cards:

``` text
#FFFFFF
```

Primary text:

``` text
#111827
```

Secondary:

``` text
#667085
```

Muted:

``` text
#98A2B3
```

Border:

``` text
#E5E7EB
```

Risk:

``` text
LOW       → green
MEDIUM    → amber
HIGH      → red
CRITICAL  → deep red
```

AI:

Use a very subtle blue/purple tinted surface.

Do not use neon colors.

Do not use gradients.

Do not make every AI component purple.

Risk colors should communicate risk only.

------------------------------------------------------------------------

# 8. TYPOGRAPHY

Use:

``` css
-apple-system,
BlinkMacSystemFont,
"SF Pro Display",
"SF Pro Text",
Inter,
"Segoe UI",
sans-serif
```

Page title:

``` text
30–34px
600
```

Page subtitle:

``` text
14–15px
```

Section title:

``` text
18–20px
600
```

Card title:

``` text
14–16px
600
```

KPI:

``` text
28–36px
600
```

Body:

``` text
14–15px
```

Metadata:

``` text
12–13px
```

Table:

``` text
13–14px
```

------------------------------------------------------------------------

# 9. SPACING

Use:

``` text
4
8
12
16
20
24
32
40
48
```

Page padding:

``` text
32px
```

Card padding:

``` text
20–24px
```

Section spacing:

``` text
24–32px
```

------------------------------------------------------------------------

# 10. APPLICATION SHELL

Create:

``` text
AppShell
```

Layout:

``` text
┌──────────────────────────────────────────────────────────────┐
│ Top Bar                                                       │
├──────────────────┬───────────────────────────────────────────┤
│                  │                                           │
│ Sidebar          │ Main Content                              │
│                  │                                           │
│                  │                                           │
└──────────────────┴───────────────────────────────────────────┘
```

Desktop:

Sidebar:

``` text
240–260px
```

Top bar:

``` text
64–72px
```

Main content:

``` text
max-width: 1440px
```

------------------------------------------------------------------------

# 11. SIDEBAR

Top:

``` text
Clinical Ops
Risk Monitor
```

Study:

``` text
STUDY

CT-801-ONC
Oncology Phase II
```

Navigation:

``` text
OVERVIEW

Dashboard

MONITORING

Sites
Deviations

ACTIONS

CAPA

CONFIGURATION

Protocol
Audit
```

Use Lucide icons.

Icon size:

``` text
16–20px
```

Selected navigation:

-   subtle background
-   dark text
-   small accent indicator

Do not use giant colored navigation blocks.

Bottom:

``` text
SYSTEM

● All systems operational

Powered by
IBM watsonx.ai
```

This is visual branding only.

Do not connect it to a real system-status API.

------------------------------------------------------------------------

# 12. TOP BAR

Left:

Breadcrumb.

Examples:

``` text
Clinical Ops / Dashboard
```

``` text
Clinical Ops / Sites / Site 104
```

Right:

``` text
Study:
CT-801-ONC
```

Then:

-   notification icon
-   optional settings icon
-   user avatar

Avatar:

``` text
JD
```

All interactions can use frontend dummy behavior.

------------------------------------------------------------------------

# 13. GLOBAL PAGE HEADER

Every page needs:

-   title
-   subtitle
-   breadcrumb
-   action buttons where useful

Example:

``` text
Executive Dashboard

Clinical trial monitoring overview.

Last updated 2 min ago

[Refresh]
```

The "Refresh" button can simply refresh the local mock data state.

Do not call backend.

------------------------------------------------------------------------

# 14. PAGE --- EXECUTIVE DASHBOARD

Route:

``` text
/dashboard
```

Purpose:

Give the user an immediate overview.

The dashboard should answer:

-   How is the trial doing?
-   Which sites are risky?
-   How many deviations exist?
-   What needs attention?

------------------------------------------------------------------------

## Header

``` text
Executive Dashboard

Clinical trial monitoring overview
```

Right:

``` text
Last updated
2 min ago

[Refresh]

[Recalculate Risk]
```

Since this is dummy UI:

-   Refresh can update the displayed timestamp or simulate loading.
-   Recalculate Risk can show a frontend-only loading state and then
    keep/mock the existing values.
-   Do not call backend.

------------------------------------------------------------------------

# 15. DASHBOARD KPI CARDS

Create four cards.

### Sites

``` text
10
Across the trial
```

### Patients

``` text
100
Active participants
```

### Protocol Deviations

``` text
47
12 major
```

### High-Risk Sites

``` text
1
Requires attention
```

These are dummy values stored in mock data.

Do not place values directly in JSX.

------------------------------------------------------------------------

# 16. TRIAL HEALTH

Create:

``` text
Trial Health

Overall monitoring status
```

Dummy state:

``` text
ATTENTION

1 site requires investigation.
```

Add a subtle status indicator.

------------------------------------------------------------------------

# 17. TOP RISK SITES

Create:

``` text
Top Risk Sites
```

Show approximately 5 sites.

Columns:

-   Site
-   Name
-   Risk
-   Level
-   Trend
-   Action

Example:

``` text
Site 104
City General Hospital
75.6
HIGH
↑
View
```

Use horizontal bars.

------------------------------------------------------------------------

# 18. RISK DISTRIBUTION

Create:

``` text
Risk Distribution
```

Use a donut chart.

Center:

``` text
10
Sites
```

Legend:

``` text
LOW
MEDIUM
HIGH
```

Use Recharts.

------------------------------------------------------------------------

# 19. HIGH-RISK SITE CARD

Create a prominent but elegant card.

Example:

``` text
HIGH-RISK SITE

Site 104
City General Hospital

75.6 / 100

Primary drivers:

6 major dosing deviations
4 missed safety visits
2 prohibited medication events

[View Site]

[Explain Risk]
```

For this frontend-only version:

`Explain Risk` opens the AI result using dummy local data.

Do NOT call `/api/ai/explain-site`.

------------------------------------------------------------------------

# 20. AI RISK EXPLANATION --- DUMMY

When user clicks:

``` text
Explain Risk
```

show loading:

``` text
Analyzing site evidence...
```

Then show dummy AI output:

``` text
AI Risk Analysis

Site 104 is classified as HIGH risk primarily due to
repeated dosing deviations and missed safety visits.

Key Drivers:

• 6 major dosing deviations
• 4 missed safety visits
• 2 prohibited medication events

Evidence:

DEV-0001
DOSE-003
P104-003

Recommended Focus:

Review the site's dosing administration workflow and
safety-visit scheduling process.
```

Clearly label:

``` text
AI-generated demo response
```

This is dummy data.

------------------------------------------------------------------------

# 21. DEVIATION TREND

Create:

``` text
Protocol Deviations Over Time
```

Use a line chart.

Use dummy weekly data:

``` text
Week 1
Week 2
Week 3
Week 4
```

Show a realistic but synthetic trend.

------------------------------------------------------------------------

# 22. RECENT DEVIATIONS

Create table:

``` text
Recent Protocol Deviations
```

Columns:

-   ID
-   Site
-   Patient
-   Rule
-   Category
-   Severity
-   Status
-   Detected

Use mock data.

Click row:

Open deviation drawer.

------------------------------------------------------------------------

# 23. PAGE --- SITE RANKING

Route:

``` text
/sites
```

Header:

``` text
Site Risk

Prioritized view of clinical trial sites.
```

Action:

``` text
[Recalculate Risk]
```

Frontend-only behavior.

------------------------------------------------------------------------

# 24. SITE FILTER BAR

Search:

``` text
Search sites...
```

Filters:

``` text
All
Low
Medium
High
```

Sort:

``` text
Risk Score
Deviation Count
Major Deviations
Recent Activity
```

All filtering and sorting must happen locally.

No backend calls.

------------------------------------------------------------------------

# 25. SITE TABLE

Columns:

``` text
Rank
Site
Location
Patients
Deviations
Major
Risk Score
Risk Level
Trend
Action
```

Use mock data.

Row click:

``` text
/sites/:siteId
```

------------------------------------------------------------------------

# 26. PAGE --- SITE DETAILS

Route:

``` text
/sites/:siteId
```

Header:

``` text
← Sites

Site 104

City General Hospital

Active
```

Right:

``` text
HIGH

75.6 / 100
```

------------------------------------------------------------------------

# 27. SITE RISK SUMMARY

Show:

``` text
75.6

HIGH RISK
```

Subtext:

``` text
Risk calculated from deterministic monitoring rules.
```

Because this is a demo, this is descriptive UI only.

------------------------------------------------------------------------

# 28. SITE RISK COMPONENTS

Cards:

``` text
Major Deviations
6
```

``` text
Missed Safety Visits
4
```

``` text
Dosing Violations
6
```

``` text
Medication Violations
2
```

``` text
Repeat Deviations
3
```

Use mock data.

------------------------------------------------------------------------

# 29. RISK DRIVERS

Show:

``` text
Primary Risk Drivers
```

Horizontal bars:

``` text
Dosing violations
██████████████

Missed safety visits
█████████

Medication violations
██████

Repeat deviations
████
```

Use local mock values.

------------------------------------------------------------------------

# 30. DEVIATION CATEGORY BREAKDOWN

Create a chart for:

-   Dosing
-   Visit
-   Medication
-   Laboratory
-   Procedural

Use Recharts.

------------------------------------------------------------------------

# 31. SITE DEVIATION LIST

Show recent deviations.

Click:

Open deviation drawer.

------------------------------------------------------------------------

# 32. SITE AI PANEL

Create:

``` text
AI Risk Analysis

IBM watsonx.ai

Why is this site high risk?

[Analyze Risk]
```

Frontend-only behavior.

When clicked:

``` text
Analyzing site evidence...
```

Then:

``` text
Summary

Site 104 is classified as HIGH risk primarily due to
repeated dosing deviations and missed safety visits.

Key Drivers

• 6 major dosing deviations
• 4 missed safety visits
• 2 prohibited medication events

Evidence

DEV-0001
DOSE-003
P104-003

Recommended Focus

Review the site's dosing administration workflow.
```

Bottom:

``` text
AI-generated demo response
```

------------------------------------------------------------------------

# 33. PAGE --- PATIENT DETAILS

Route:

``` text
/patients/:patientId
```

Header:

``` text
← Back

Patient

P104-003

Site 104

Active
```

------------------------------------------------------------------------

# 34. PATIENT SUMMARY

Cards:

``` text
Patient ID
P104-003
```

``` text
Site
Site 104
```

``` text
Enrollment
June 12, 2026
```

``` text
Current Visit
Visit 3
```

``` text
Protocol Status
Attention
```

All values from mock data.

------------------------------------------------------------------------

# 35. CLINICAL TIMELINE

Create a polished timeline:

``` text
SCREENING
✓ Completed

BASELINE
✓ Completed

VISIT 3
⚠ Deviation

VISIT 4
✓ Completed

VISIT 5
✓ Completed

VISIT 6
✓ Completed
```

Use dummy data.

Click visit:

Open visit drawer.

------------------------------------------------------------------------

# 36. VISIT DETAIL DRAWER

Show:

``` text
Visit 3

Expected Date
June 20

Actual Date
June 21

Expected Dose
100 mg ± 5 mg

Actual Dose
150 mg

Protocol Status
Deviation
```

If deviation exists:

``` text
MAJOR

Rule:
DOSE-003

Protocol Reference:
Section 5.2
```

------------------------------------------------------------------------

# 37. EXPECTED VS ACTUAL

Make this visually prominent:

``` text
EXPECTED

100 mg ± 5 mg

Allowed:
95–105 mg
```

versus:

``` text
ACTUAL

150 mg
```

Then:

``` text
MAJOR DEVIATION
```

This should be immediately understandable.

------------------------------------------------------------------------

# 38. PAGE --- DEVIATION CENTER

Route:

``` text
/deviations
```

Header:

``` text
Protocol Deviations

47 detected deviations

Review deviations detected by approved protocol rules.
```

------------------------------------------------------------------------

# 39. DEVIATION SUMMARY

Cards:

``` text
Total
47
```

``` text
Critical
2
```

``` text
Major
12
```

``` text
Minor
33
```

``` text
Open
18
```

All dummy data.

------------------------------------------------------------------------

# 40. DEVIATION FILTERS

Search:

``` text
Search deviation ID, site, patient or rule...
```

Filters:

-   Severity
-   Site
-   Category
-   Status
-   Date

Perform filtering locally.

------------------------------------------------------------------------

# 41. DEVIATION TABLE

Columns:

``` text
Deviation ID
Site
Patient
Rule
Category
Severity
Detected
Status
Action
```

Click:

Open detail drawer.

------------------------------------------------------------------------

# 42. DEVIATION DETAIL DRAWER

Show:

``` text
DEV-0001

MAJOR

OPEN
```

Sections:

-   Overview
-   Site
-   Patient
-   Visit
-   Rule
-   Expected
-   Actual
-   Evidence
-   Protocol Reference
-   Detection Details
-   Risk Impact
-   CAPA

Button:

``` text
[Generate CAPA]
```

------------------------------------------------------------------------

# 43. TRACEABILITY VIEW

This is one of the most important screens.

Show:

``` text
CLINICAL DATA
      ↓
RULE DOSE-003
      ↓
DEVIATION DEV-0001
      ↓
SEVERITY: MAJOR
      ↓
SITE RISK IMPACT
      ↓
AI ASSISTANCE
      ↓
CAPA
      ↓
HUMAN APPROVAL
      ↓
AUDIT TRAIL
```

Use a clean vertical flow.

------------------------------------------------------------------------

# 44. TRACEABILITY DRAWER

Use:

``` text
DEV-0001
MAJOR

Site 104
Patient P104-003
Visit 3

────────────────────────

PROTOCOL RULE

DOSE-003

Dose must remain
100 mg ± 5 mg

Protocol Section 5.2

              ↓

OBSERVED DATA

Expected: 100 mg
Actual:   150 mg

              ↓

DETERMINISTIC CHECK

150 mg > 105 mg

              ↓

DEVIATION

Major

              ↓

SITE IMPACT

Site 104
Risk: 75.6 HIGH

              ↓

AI ASSISTANCE

IBM watsonx.ai

[Explain]

              ↓

ACTION

[Generate CAPA]
```

Everything comes from mock data.

------------------------------------------------------------------------

# 45. PAGE --- CAPA MANAGEMENT

Route:

``` text
/capa
```

Header:

``` text
CAPA Management

AI-assisted corrective and preventive action workflow.
```

------------------------------------------------------------------------

# 46. CAPA STATUS TABS

Use:

``` text
Draft
Pending Review
Approved
Rejected
Closed
```

Show local mock counts.

------------------------------------------------------------------------

# 47. CAPA CARDS

Example:

``` text
CAPA-001

Related deviation:
DEV-0001

Site:
104

Priority:
HIGH

Status:
DRAFT

AI Generated
```

Click card:

Open CAPA detail.

------------------------------------------------------------------------

# 48. CAPA DETAIL

Show:

``` text
CAPA-001

AI-generated demo draft

Human approval required
```

Sections:

``` text
Problem

Root Cause Hypothesis

Immediate Action

Corrective Action

Preventive Action

Verification Method

Owner Role

Target Date
```

------------------------------------------------------------------------

# 49. CAPA AI DEMO

Show:

``` text
Generated by IBM watsonx.ai

Demo response based on supplied deviation evidence.
```

Use dummy text.

Do not make an actual AI request.

------------------------------------------------------------------------

# 50. CAPA ACTIONS

Buttons:

``` text
[Edit]
[Approve]
[Reject]
```

Approve dialog:

``` text
Approve CAPA?

This demo action will update the local frontend state
and add a local audit event.

[Cancel]

[Approve CAPA]
```

IMPORTANT:

This must only modify React/local mock state.

Do not call backend.

------------------------------------------------------------------------

# 51. PAGE --- PROTOCOL RULES

Route:

``` text
/protocol
```

Header:

``` text
Protocol Rules

20 executable rules

Rules derived from the approved clinical trial protocol.
```

Button:

``` text
[Upload Protocol]
```

For this dummy UI, clicking Upload Protocol can show a simulated upload
state.

Do not upload to backend.

------------------------------------------------------------------------

# 52. PROTOCOL STATUS

Show:

``` text
Protocol:
CT-801-ONC

Version:
1.0

Rules:
20

Approved:
18

Pending:
2
```

Mock values only.

------------------------------------------------------------------------

# 53. PROTOCOL RULE TABLE

Columns:

``` text
Rule ID
Category
Name
Condition
Severity
Protocol Reference
Status
```

Example:

``` text
DOSE-003
Dosing
Dose Range Validation
100 mg ± 5 mg
Major
Section 5.2
Approved
```

Use local mock data.

------------------------------------------------------------------------

# 54. RULE DETAIL DRAWER

Show:

-   Rule ID
-   Category
-   Description
-   Condition
-   Threshold
-   Expected Value
-   Protocol Reference
-   Source Evidence
-   Severity
-   Approval Status
-   Approved By
-   Approved At

------------------------------------------------------------------------

# 55. PROTOCOL AI EXTRACTION DEMO

Create this UI:

``` text
STEP 1

Upload Protocol PDF

        ↓

STEP 2

IBM watsonx.ai

Extracting candidate rules...

        ↓

STEP 3

Candidate Rules

Review extracted rules

        ↓

STEP 4

Human Review

[Approve]
[Edit]
[Reject]

        ↓

STEP 5

Approved Rule

EXECUTABLE
```

For this version:

Everything is simulated locally.

No real PDF upload.

No real watsonx.ai call.

No backend change.

The UI should look ready for future integration.

------------------------------------------------------------------------

# 56. PAGE --- AUDIT TRAIL

Route:

``` text
/audit
```

Header:

``` text
Audit Trail

Complete history of monitoring and workflow actions.
```

Optional:

``` text
[Export]
```

Export can download/display local mock data only.

------------------------------------------------------------------------

# 57. AUDIT FILTERS

Use:

``` text
All
System
User
AI
Rules
Deviations
CAPA
Risk
```

Filter local mock audit data.

------------------------------------------------------------------------

# 58. AUDIT TIMELINE

Create a clean vertical timeline.

Example:

``` text
14:32

CAPA Approved

User:
JD

CAPA:
CAPA-001

Related:
DEV-0001
```

Then:

``` text
14:30

CAPA Generated

Actor:
IBM watsonx.ai

CAPA:
CAPA-001
```

Then:

``` text
14:28

AI Risk Analysis Generated

Site:
104
```

Then:

``` text
14:25

Risk Recalculated

Site:
104

Score:
72.4 → 75.6
```

Then:

``` text
14:20

Deviation Detected

DEV-0001

Rule:
DOSE-003
```

Then:

``` text
14:15

Protocol Rule Approved

DOSE-003

Approved by:
JD
```

All are local mock events.

------------------------------------------------------------------------

# 59. AUDIT EVENT DETAIL

Click event.

Open drawer.

Show:

-   timestamp
-   actor
-   actor type
-   action
-   entity
-   entity ID
-   previous value
-   new value
-   details
-   related deviation
-   related CAPA

------------------------------------------------------------------------

# 60. AI VISUAL LANGUAGE

AI components should look consistent.

Use:

``` text
IBM watsonx.ai
```

badge.

Use:

-   subtle AI icon
-   subtle tinted background
-   thin border
-   restrained visual treatment

Avoid:

-   giant robot icons
-   glowing cards
-   neon purple
-   chatbot bubbles
-   unnecessary animations

AI is an assistant inside the clinical workflow.

------------------------------------------------------------------------

# 61. DUMMY AI STATES

Every AI button should have:

### Idle

``` text
[Analyze Risk]
```

### Loading

``` text
Analyzing clinical evidence...
```

### Success

Show dummy AI result.

### Error

``` text
AI analysis is temporarily unavailable.

Demo fallback content is available.

[Retry]
```

All state changes are local frontend state.

------------------------------------------------------------------------

# 62. DRAWER SYSTEM

Create reusable drawers for:

-   site details
-   patient visit details
-   deviation details
-   protocol rule details
-   CAPA details
-   audit event details

Desktop:

``` text
420–520px
```

Mobile:

``` text
full screen
```

Animation:

``` text
150–250ms
```

------------------------------------------------------------------------

# 63. TOAST SYSTEM

Create frontend-only toast notifications.

Examples:

``` text
Risk recalculated successfully.
```

``` text
CAPA generated.
```

``` text
CAPA approved.
```

``` text
Protocol rule approved.
```

``` text
AI analysis completed.
```

``` text
Demo data refreshed.
```

No browser alerts.

------------------------------------------------------------------------

# 64. BUTTON SYSTEM

Primary:

-   dark/black or restrained accent
-   white text

Secondary:

-   white
-   border

Danger:

-   subtle red

Dimensions:

``` text
36–40px height
8–10px radius
```

Avoid oversized buttons.

------------------------------------------------------------------------

# 65. TABLE SYSTEM

Use:

-   sticky header
-   subtle border
-   row hover
-   compact spacing
-   clear hierarchy
-   responsive behavior

Avoid excessive vertical borders.

Use:

``` text
13–14px
```

for table content.

------------------------------------------------------------------------

# 66. CHART SYSTEM

Use:

``` text
Recharts
```

Recommended:

-   line chart
-   donut chart
-   horizontal risk bars
-   category breakdown

Avoid:

-   3D
-   rainbow colors
-   excessive gradients
-   unnecessary charts

Charts should communicate a decision.

------------------------------------------------------------------------

# 67. LOADING STATES

Every page should have realistic loading states.

Dashboard:

-   KPI skeletons
-   chart skeleton
-   table skeleton

Sites:

-   table skeleton

Site details:

-   risk skeleton
-   driver skeleton
-   deviation skeleton

Patient:

-   timeline skeleton

CAPA:

-   card skeleton

Protocol:

-   rule table skeleton

Audit:

-   timeline skeleton

AI:

``` text
Analyzing...
```

All loading is simulated locally.

------------------------------------------------------------------------

# 68. EMPTY STATES

Create frontend empty states.

Examples:

``` text
No protocol deviations detected.

All monitored records currently comply with configured rules.
```

``` text
No CAPA actions yet.
```

``` text
No audit events found.
```

``` text
No sites match your filters.
```

``` text
No protocol rules found.
```

Provide a useful action where appropriate.

------------------------------------------------------------------------

# 69. ERROR STATES

Create simulated frontend errors where useful.

Backend is not involved.

Example:

``` text
Unable to load demo monitoring data.

[Retry]
```

AI:

``` text
AI analysis is temporarily unavailable.

Demo fallback content remains available.

[Retry AI]
```

Patient:

``` text
Patient not found.

[Back to Sites]
```

Site:

``` text
Site not found.

[Back to Sites]
```

------------------------------------------------------------------------

# 70. RESPONSIVE DESIGN

Support:

``` text
1920px
1440px
1366px
1024px
768px
mobile
```

Desktop:

-   sidebar visible

Tablet:

-   sidebar collapses

Mobile:

-   hamburger menu

Tables:

-   horizontal scrolling
-   or card layout

Drawers:

-   full screen

Charts:

-   responsive

No accidental horizontal overflow.

------------------------------------------------------------------------

# 71. ACCESSIBILITY

Implement:

-   semantic HTML
-   keyboard navigation
-   visible focus states
-   ARIA labels
-   accessible buttons
-   accessible tables
-   sufficient contrast
-   screen-reader-friendly labels

Do not rely only on color.

Example:

``` text
HIGH
[red indicator]
```

instead of:

``` text
red dot only
```

------------------------------------------------------------------------

# 72. ROUTING

Frontend routes:

``` text
/dashboard
/sites
/sites/:siteId
/patients/:patientId
/deviations
/capa
/protocol
/audit
```

Use React Router if already installed.

If React Router is already present, preserve the existing setup.

Do not modify backend routing.

------------------------------------------------------------------------

# 73. LOCAL STATE

Use React state or an existing frontend state solution.

Local actions can simulate:

-   refresh
-   filtering
-   sorting
-   CAPA approval
-   CAPA rejection
-   AI loading
-   AI success
-   AI failure
-   rule approval
-   rule rejection
-   notifications
-   audit events

These changes should remain frontend-only.

No API calls.

------------------------------------------------------------------------

# 74. COMPONENT ARCHITECTURE

Create reusable components:

``` text
AppShell
Sidebar
TopBar
Breadcrumbs
PageHeader

KpiCard
RiskScore
RiskBadge
SeverityBadge
StatusBadge
RiskBar
RiskDistribution

SiteRiskTable
SiteRiskRow

DeviationTable
DeviationDrawer
DeviationEvidence
RuleTrace

PatientHeader
PatientTimeline
VisitCard
VisitDrawer

AIAnalysisCard
AIStatus
AIEvidence

CAPACard
CAPADrawer
CAPAApprovalDialog

ProtocolRuleTable
ProtocolRuleDrawer
ProtocolUpload

AuditTimeline
AuditEventDrawer

LoadingSkeleton
EmptyState
ErrorState
ConfirmDialog
Toast
```

Do not put everything inside `App.jsx`.

------------------------------------------------------------------------

# 75. RECOMMENDED FRONTEND FILE STRUCTURE

Use:

``` text
src/

components/
  layout/
  dashboard/
  sites/
  patients/
  deviations/
  capa/
  protocol/
  audit/
  ai/
  common/

pages/
  Dashboard.jsx
  SiteRanking.jsx
  SiteDetails.jsx
  PatientDetails.jsx
  DeviationCenter.jsx
  CAPAManagement.jsx
  ProtocolRules.jsx
  AuditTrail.jsx

data/
  mockData.js
  mockSites.js
  mockPatients.js
  mockDeviations.js
  mockCapa.js
  mockProtocolRules.js
  mockAudit.js

hooks/
  useMockData.js
  useLocalActions.js

utils/
  formatters.js

styles/
  globals.css
```

Adapt to the existing frontend project structure instead of
unnecessarily restructuring the whole project.

------------------------------------------------------------------------

# 76. IMPORTANT MOCK-DATA ISOLATION

All dummy data must live in:

``` text
src/data/
```

or an equivalent frontend-only location.

Components should consume mock data.

Example:

``` jsx
import { mockSites } from "../data/mockSites";
```

Do not create large arrays inside components.

Do not duplicate the same site information across pages.

Use IDs to connect data:

``` text
siteId
patientId
deviationId
ruleId
capaId
```

This makes later backend integration much easier.

------------------------------------------------------------------------

# 77. FUTURE BACKEND INTEGRATION

Design the mock objects to make future API integration easy.

For example:

``` text
mockSites
```

should eventually be replaceable with:

``` text
GET /sites
```

without redesigning the page.

Similarly:

``` text
mockDeviations
```

should eventually be replaceable with backend deviation data.

Do not build API calls now.

Do not create API service files that call the backend for this task.

Keep the UI independent.

------------------------------------------------------------------------

# 78. NO BACKEND MODIFICATION

Before finishing, verify that you have NOT:

-   edited backend files
-   changed backend routes
-   changed backend database models
-   changed backend calculations
-   changed IBM watsonx.ai integration
-   changed environment variables for backend
-   added server endpoints
-   modified server middleware
-   changed authentication
-   changed database seed data

The only intended changes are frontend UI and frontend dummy data.

------------------------------------------------------------------------

# 79. HERO WORKFLOW

The primary demo workflow should be:

``` text
Dashboard
    ↓
Site Ranking
    ↓
Site 104
    ↓
Risk Drivers
    ↓
AI Risk Explanation
    ↓
Deviation DEV-0001
    ↓
Traceability
    ↓
Generate CAPA
    ↓
Approve CAPA
    ↓
Audit Trail
```

Everything is frontend-only for now.

------------------------------------------------------------------------

# 80. TRACEABILITY DEMO

When the user opens DEV-0001:

Show:

``` text
Protocol Rule
DOSE-003

        ↓

Expected
100 mg ± 5 mg

        ↓

Actual
150 mg

        ↓

Deviation
DEV-0001

        ↓

Severity
MAJOR

        ↓

Site Risk
75.6 HIGH

        ↓

AI Explanation
Generated

        ↓

CAPA
CAPA-001

        ↓

Approval
JD

        ↓

Audit Event
AUDIT-001
```

This should feel like a complete working product even though the data is
local dummy data.

------------------------------------------------------------------------

# 81. VISUAL QA

After implementation, inspect every page.

Check:

-   no excessive empty space
-   no blank pages
-   consistent margins
-   consistent card heights
-   consistent typography
-   consistent buttons
-   consistent badges
-   consistent tables
-   correct alignment
-   good chart sizing
-   restrained colors
-   clean navigation
-   responsive behavior
-   accessible interactions

The interface should feel cohesive.

------------------------------------------------------------------------

# 82. DO NOT OVER-DESIGN

Do not add components just to make the page look full.

Do not add:

-   meaningless charts
-   decorative statistics
-   random gradients
-   excessive icons
-   huge illustrations
-   fake AI chat
-   unnecessary animations
-   excessive glass effects

Every element must support:

``` text
Understanding
Investigation
Decision
Action
Traceability
```

------------------------------------------------------------------------

# 83. FINAL UI TARGET

The application should feel:

``` text
Minimal
Precise
Clinical
Trustworthy
Premium
Evidence-driven
AI-assisted
Human-controlled
```

------------------------------------------------------------------------

# 84. FINAL IMPLEMENTATION ORDER

Build in this order.

## Phase 1

Create:

-   design tokens
-   global CSS
-   AppShell
-   Sidebar
-   TopBar
-   routing
-   reusable components
-   mock-data architecture

Do not touch backend.

## Phase 2

Build:

-   Executive Dashboard

Use dummy data only.

## Phase 3

Build:

-   Site Ranking
-   Site Details

## Phase 4

Build:

-   Patient Details
-   Patient Timeline

## Phase 5

Build:

-   Deviation Center
-   Deviation Drawer
-   Traceability workflow

## Phase 6

Build:

-   CAPA Management
-   local approval workflow
-   local audit event generation

## Phase 7

Build:

-   Protocol Rules
-   simulated protocol extraction workflow
-   local rule approval

## Phase 8

Build:

-   Audit Trail

## Phase 9

Add:

-   loading states
-   empty states
-   error states
-   success states
-   toasts
-   responsive states

## Phase 10

Perform:

-   accessibility QA
-   visual QA
-   route testing
-   interaction testing

------------------------------------------------------------------------

# 85. FINAL TEST

Run:

``` text
npm run dev
```

Open:

``` text
http://localhost:5174
```

Test:

``` text
Dashboard
    ↓
Sites
    ↓
Site Details
    ↓
Patient Details
    ↓
Deviation Center
    ↓
Deviation Drawer
    ↓
AI Explanation
    ↓
Generate CAPA
    ↓
Approve CAPA
    ↓
Audit Trail
```

Test every sidebar item.

Test every button.

Test every drawer.

Test every filter.

Test search.

Test sorting.

Test local state changes.

Test loading states.

Test empty states.

Test error states.

Test mobile layout.

------------------------------------------------------------------------

# 86. FINAL SAFETY CHECK

Before finishing, inspect the Git diff or changed files.

The expected change should be frontend-only.

If you find backend changes:

STOP.

Revert those backend changes.

Do not continue until the backend is unchanged.

The final implementation must satisfy:

``` text
FRONTEND UI
+
FRONTEND MOCK DATA
+
LOCAL FRONTEND INTERACTIONS
=
COMPLETE DEMO
```

and NOT:

``` text
FRONTEND
+
BACKEND CHANGES
```

------------------------------------------------------------------------

# 87. FINAL INSTRUCTION

Build a complete, polished, functioning frontend demo.

Use dummy data exclusively.

Keep all dummy data isolated inside the frontend.

Do not call the backend.

Do not modify the backend.

Do not affect any existing backend functionality.

Make the UI look production-ready so that later the team can replace the
mock data with real backend data without redesigning the interface.

The goal right now is:

**A complete frontend prototype with realistic dummy data and working
local interactions, while the backend remains completely untouched.**
