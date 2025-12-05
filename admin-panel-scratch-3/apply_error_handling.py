#!/usr/bin/env python3
import re

# Read the file
with open('mongo-init/01-init.js', 'r') as f:
    content = f.read()

# Pattern: find "print('X inserted: ..." and add try-catch closing
replacements = [
    (r"(print\('Users inserted: ' \+ db\.users\.countDocuments\(\)\);)",
     r"    print('✓ Users inserted: ' + db.users.countDocuments());\n} catch (error) {\n    print('✗ Error inserting users: ' + error);\n    throw error;\n}"),
    
    (r"(print\('Domain Scenarios inserted: ' \+ db\.domain_scenarios\.countDocuments\(\)\);)",
     r"    print('✓ Domain Scenarios inserted: ' + db.domain_scenarios.countDocuments());\n} catch (error) {\n    print('✗ Error inserting domain scenarios: ' + error);\n    throw error;\n}"),
    
    (r"(print\('Playboards inserted: ' \+ db\.playboards\.countDocuments\(\)\);)",
     r"    print('✓ Playboards inserted: ' + db.playboards.countDocuments());\n} catch (error) {\n    print('✗ Error inserting playboards: ' + error);\n    throw error;\n}"),
    
    (r"(print\('Configurations inserted: ' \+ db\.configurations\.countDocuments\(\)\);)",
     r"    print('✓ Configurations inserted: ' + db.configurations.countDocuments());\n} catch (error) {\n    print('✗ Error inserting configurations: ' + error);\n    throw error;\n}"),
    
    (r"(print\('Audit logs inserted: ' \+ db\.audit_logs\.countDocuments\(\)\);)",
     r"    print('✓ Audit logs inserted: ' + db.audit_logs.countDocuments());\n} catch (error) {\n    print('✗ Error inserting audit logs: ' + error);\n    throw error;\n}"),
]

# Add print and try blocks before insertMany
insert_replacements = [
    (r"(// DOMAIN SCENARIOS\n// ============================================\n)(db\.domain_scenarios\.insertMany)",
     r"\1print('Inserting domain scenarios...');\ntry {\n    \2"),
    
    (r"(// PLAYBOARDS\n// ============================================\n)(db\.playboards\.insertMany)",
     r"\1print('Inserting playboards...');\ntry {\n    \2"),
    
    (r"(// CONFIGURATIONS\n// ============================================\n)(db\.configurations\.insertMany)",
     r"\1print('Inserting configurations...');\ntry {\n    \2"),
    
    (r"(// AUDIT LOGS \(Sample Activity Data\)\n// ============================================\n)(var now)",
     r"\1print('Inserting audit logs...');\ntry {\n    \2"),
]

# Apply replacements
for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content)

for pattern, replacement in insert_replacements:
    content = re.sub(pattern, replacement, content, flags=re.MULTILINE)

# Write back
with open('mongo-init/01-init.js', 'w') as f:
    f.write(content)

print("✓ Applied error handling to all insert sections")
