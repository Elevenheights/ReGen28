@echo off
if not exist "docs\archive" mkdir "docs\archive"

move COMPREHENSIVE_APP_ANALYSIS.md docs\archive\
move DEPLOYMENT_STATUS.md docs\archive\
move FUNCTION_CONSOLIDATION_PLAN.md docs\archive\
move LOGGING_LOGIC_ANALYSIS.md docs\archive\
move MIGRATION_COMPLETE.md docs\archive\
move SETTINGS_TRIGGER_ADDED.md docs\archive\
move TRACKER_FEATURES_ANALYSIS.md docs\archive\
move UI_OVERHAUL_TODO.md docs\archive\
move dashboard-fixes-todo.md docs\archive\

move COMMANDS.md docs\
move MANUAL_TRIGGER_GUIDE.md docs\
move TESTING_CHECKLIST.md docs\
move project-checklist.md docs\
move REGEN28_COMMANDS.txt docs\REGEN28_COMMANDS.md

echo Cleanup of root directory complete.
