#!/usr/bin/env ruby
# remove_duplicate_features.rb
#
# Removes duplicate entries in features.json based on FEATURE_ID (or another field)

require 'json'
require 'fileutils'

FEATURES_JSON = 'features.json' # path to your main file
DEDUP_KEY = 'FEATURE_ID'        # change if needed (e.g., 'id', 'feature_id')

# Load JSON
features = JSON.parse(File.read(FEATURES_JSON))
unless features.is_a?(Array)
  abort "❌ features.json must be an array of feature objects."
end

# Backup original
backup = "#{FEATURES_JSON}.bak.#{Time.now.strftime('%Y%m%d%H%M%S')}"
FileUtils.cp(FEATURES_JSON, backup)
puts "🗂  Backup saved: #{backup}"

# Deduplicate
seen = {}
deduped = []

features.each do |feature|
  key_val = feature[DEDUP_KEY] || feature[DEDUP_KEY.downcase] || feature[DEDUP_KEY.capitalize]
  next unless key_val
  key = key_val.to_s.strip

  if seen[key]
    puts "⚠️  Duplicate found for #{DEDUP_KEY}=#{key}, removing duplicate."
    next
  else
    seen[key] = true
    deduped << feature
  end
end

# Save deduped JSON
File.write(FEATURES_JSON, JSON.pretty_generate(deduped))
puts "✅ Deduplicated features.json"
puts "   Original count: #{features.size}"
puts "   New count: #{deduped.size}"
puts "   Removed: #{features.size - deduped.size} duplicates"

