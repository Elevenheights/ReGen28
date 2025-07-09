import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, Rectangle
import numpy as np

# Set up the figure with more space
fig, ax = plt.subplots(1, 1, figsize=(20, 14))
ax.set_xlim(0, 12)
ax.set_ylim(0, 12)
ax.axis('off')

# Clean color scheme
colors = {
    'main': '#2196F3',
    'trackers': '#E3F2FD', 
    'goals': '#E8F5E8',
    'mood': '#FFF3E0',
    'journal': '#F3E5F5',
    'dashboard': '#E8EAF6',
    'mind': '#BBDEFB',
    'body': '#C8E6C9',
    'soul': '#E1BEE7',
    'beauty': '#F8BBD9',
    'financial': '#B2EBF2'
}

# Main title
title_box = FancyBboxPatch((1, 10.5), 10, 1, 
                          boxstyle="round,pad=0.2", 
                          facecolor=colors['main'], alpha=0.8,
                          edgecolor='#1976D2', linewidth=2)
ax.add_patch(title_box)
ax.text(6, 11, 'ReGen28 Wellness Platform Architecture', 
        fontsize=22, fontweight='bold', ha='center', color='white')

# Left side - Daily Trackers
trackers_box = FancyBboxPatch((0.5, 6.5), 4.5, 3.5, 
                             boxstyle="round,pad=0.15", 
                             facecolor=colors['trackers'], 
                             edgecolor='#1976D2', linewidth=1.5)
ax.add_patch(trackers_box)

ax.text(2.75, 9.5, 'Daily Trackers', fontsize=18, fontweight='bold', ha='center', color='#1976D2')
ax.text(2.75, 9.1, 'Habits & Wellness', fontsize=12, ha='center', style='italic', color='#666')

# Tracker categories - cleaner layout
tracker_data = [
    ('Mind', 'Meditation • Focus • Learning', colors['mind'], '#1976D2'),
    ('Body', 'Exercise • Sleep • Nutrition', colors['body'], '#388E3C'),
    ('Soul', 'Gratitude • Prayer • Connection', colors['soul'], '#7B1FA2'),
    ('Beauty', 'Skincare • Self-Care • Grooming', colors['beauty'], '#C2185B')
]

for i, (category, desc, bg_color, text_color) in enumerate(tracker_data):
    y_pos = 8.5 - i * 0.6
    
    # Category box
    cat_box = FancyBboxPatch((0.8, y_pos-0.2), 3.9, 0.4, 
                            boxstyle="round,pad=0.08", 
                            facecolor=bg_color, alpha=0.9,
                            edgecolor=text_color, linewidth=1)
    ax.add_patch(cat_box)
    
    ax.text(1.2, y_pos, category, fontsize=13, fontweight='bold', va='center', color=text_color)
    ax.text(1.2, y_pos-0.15, desc, fontsize=10, va='center', color='#444')

# Right side - Long-term Goals
goals_box = FancyBboxPatch((7, 6.5), 4.5, 3.5, 
                          boxstyle="round,pad=0.15", 
                          facecolor=colors['goals'], 
                          edgecolor='#388E3C', linewidth=1.5)
ax.add_patch(goals_box)

ax.text(9.25, 9.5, 'Long-term Goals', fontsize=18, fontweight='bold', ha='center', color='#388E3C')
ax.text(9.25, 9.1, 'Achievements & Milestones', fontsize=12, ha='center', style='italic', color='#666')

# Goal categories - organized in two columns
goal_left = ['Career', 'Personal', 'Health', 'Lifestyle']
goal_right = ['Relationships', 'Financial', 'Education', 'Custom']

for i, goal in enumerate(goal_left):
    y_pos = 8.5 - i * 0.4
    goal_box = Rectangle((7.3, y_pos-0.15), 1.6, 0.3, 
                        facecolor=colors['financial'], alpha=0.7,
                        edgecolor='#388E3C', linewidth=1)
    ax.add_patch(goal_box)
    ax.text(8.1, y_pos, goal, fontsize=11, fontweight='bold', ha='center', va='center', color='#2E7D32')

for i, goal in enumerate(goal_right):
    y_pos = 8.5 - i * 0.4
    goal_box = Rectangle((9.2, y_pos-0.15), 1.6, 0.3, 
                        facecolor=colors['financial'], alpha=0.7,
                        edgecolor='#388E3C', linewidth=1)
    ax.add_patch(goal_box)
    ax.text(10, y_pos, goal, fontsize=11, fontweight='bold', ha='center', va='center', color='#2E7D32')

# Top Center - Universal Mood Tracker
mood_box = FancyBboxPatch((3.5, 4.8), 5, 1.2, 
                         boxstyle="round,pad=0.15", 
                         facecolor=colors['mood'], 
                         edgecolor='#F57C00', linewidth=2)
ax.add_patch(mood_box)

ax.text(6, 5.7, 'Universal Mood Tracker', fontsize=16, fontweight='bold', ha='center', color='#E65100')
ax.text(6, 5.4, 'Daily Mood • Energy Level • Overall Wellness', fontsize=11, ha='center', color='#BF360C')
ax.text(6, 5.1, 'Correlates with trackers, goals, and journal entries', fontsize=10, ha='center', style='italic', color='#666')

# Left Center - Journal System
journal_box = FancyBboxPatch((0.5, 3.2), 4.5, 1.2, 
                            boxstyle="round,pad=0.15", 
                            facecolor=colors['journal'], 
                            edgecolor='#7B1FA2', linewidth=1.5)
ax.add_patch(journal_box)

ax.text(2.75, 4.1, 'Journal System', fontsize=16, fontweight='bold', ha='center', color='#4A148C')
ax.text(2.75, 3.8, 'Reflections • Prompts • Insights', fontsize=11, ha='center', color='#6A1B9A')
ax.text(2.75, 3.5, 'Mood tracking within entries', fontsize=10, ha='center', style='italic', color='#666')

# Right Center - Goals Progress
goals_progress_box = FancyBboxPatch((7, 3.2), 4.5, 1.2, 
                                   boxstyle="round,pad=0.15", 
                                   facecolor=colors['financial'], 
                                   edgecolor='#00695C', linewidth=1.5)
ax.add_patch(goals_progress_box)

ax.text(9.25, 4.1, 'Goal Progress Tracking', fontsize=16, fontweight='bold', ha='center', color='#004D40')
ax.text(9.25, 3.8, 'Milestones • Deadlines • Achievements', fontsize=11, ha='center', color='#00695C')
ax.text(9.25, 3.5, 'Photo documentation & progress notes', fontsize=10, ha='center', style='italic', color='#666')

# BOTTOM CENTER - Main Dashboard (ROOT)
dashboard_box = FancyBboxPatch((2, 0.8), 8, 1.8, 
                              boxstyle="round,pad=0.2", 
                              facecolor=colors['dashboard'], 
                              edgecolor='#303F9F', linewidth=3)
ax.add_patch(dashboard_box)

ax.text(6, 2.2, 'CENTRAL DASHBOARD', fontsize=20, fontweight='bold', ha='center', color='#1A237E')
ax.text(6, 1.9, 'Root Hub for All Platform Data', fontsize=14, ha='center', style='italic', color='#283593')
ax.text(6, 1.5, 'Analytics • Insights • Progress Overview • Correlations', fontsize=12, ha='center', color='#3F51B5')
ax.text(6, 1.2, 'Unified view of wellness journey and goal achievement', fontsize=11, ha='center', color='#5C6BC0')

# Arrows pointing TO the dashboard (everything feeds into it)
arrow_style = dict(arrowstyle='->', lw=3, alpha=0.8)

# Trackers to Dashboard
ax.annotate('', xy=(3.5, 2.6), xytext=(2.75, 6.5),
            arrowprops=dict(**arrow_style, color='#1976D2'))
ax.text(2.5, 4.5, 'Tracker\nData', fontsize=10, ha='center', color='#1976D2', fontweight='bold')

# Goals to Dashboard  
ax.annotate('', xy=(8.5, 2.6), xytext=(9.25, 6.5),
            arrowprops=dict(**arrow_style, color='#388E3C'))
ax.text(9.5, 4.5, 'Goal\nProgress', fontsize=10, ha='center', color='#388E3C', fontweight='bold')

# Mood to Dashboard
ax.annotate('', xy=(6, 2.6), xytext=(6, 4.8),
            arrowprops=dict(**arrow_style, color='#F57C00'))
ax.text(6.8, 3.7, 'Mood\nData', fontsize=10, ha='center', color='#F57C00', fontweight='bold')

# Journal to Dashboard
ax.annotate('', xy=(4.5, 2.6), xytext=(2.75, 3.2),
            arrowprops=dict(**arrow_style, color='#7B1FA2'))
ax.text(3.2, 2.9, 'Journal\nInsights', fontsize=10, ha='center', color='#7B1FA2', fontweight='bold')

# Goal Progress to Dashboard
ax.annotate('', xy=(7.5, 2.6), xytext=(9.25, 3.2),
            arrowprops=dict(**arrow_style, color='#00695C'))
ax.text(8.8, 2.9, 'Progress\nUpdates', fontsize=10, ha='center', color='#00695C', fontweight='bold')

# Mood correlation arrows (bidirectional) - connecting mood to trackers and journal
ax.annotate('', xy=(3.5, 5.4), xytext=(2.75, 6.5),
            arrowprops=dict(arrowstyle='<->', lw=2, alpha=0.6, color='#FF9800', linestyle='dashed'))
ax.annotate('', xy=(8.5, 5.4), xytext=(9.25, 6.5),
            arrowprops=dict(arrowstyle='<->', lw=2, alpha=0.6, color='#FF9800', linestyle='dashed'))
ax.annotate('', xy=(3.5, 5.4), xytext=(2.75, 4.4),
            arrowprops=dict(arrowstyle='<->', lw=2, alpha=0.6, color='#FF9800', linestyle='dashed'))

# Add subtle background grid
ax.grid(True, alpha=0.1, color='#BDBDBD')

plt.tight_layout()
plt.savefig('regen28_architecture.png', dpi=300, bbox_inches='tight', 
            facecolor='white', edgecolor='none', pad_inches=0.2)
plt.show()

print("✅ Clean architecture diagram saved as 'regen28_architecture.png'")
print("🎨 Design improvements:")
print("   ✓ Dashboard positioned as central root hub at bottom")
print("   ✓ All components feed data into the dashboard")
print("   ✓ Journal system now includes mood tracking capability")
print("   ✓ Clear data flow arrows pointing to dashboard")
print("   ✓ Professional layout with proper spacing")
print("   ✓ Mood correlations shown across all components") 