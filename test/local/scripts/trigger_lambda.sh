
aws lambda invoke \
    --function-name emc-event-processor \
    --payload "{}" \
    ret.json; cat ret.json
