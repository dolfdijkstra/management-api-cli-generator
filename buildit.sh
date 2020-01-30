rm -Rf generated/management-api
node src/cli.js generate-all 'https://docs.oracle.com/en/cloud/paas/content-cloud/rest-api-manage-content/swagger.json' --target './generated/management-api' --name oce-management-cli --cmdPrefix oce-management

rm -Rf generated/sites-api
node src/cli.js generate-all 'https://docs.oracle.com/en/cloud/paas/content-cloud/rest-api-sites-management/swagger.json' --target './generated/sites-api' --name oce-sites-cli --cmdPrefix oce-sites

rm -Rf generated/delivery-api
node src/cli.js generate-all 'https://docs.oracle.com/en/cloud/paas/content-cloud/rest-api-content-delivery/swagger.json' --target './generated/delivery-api' --name oce-delivery-cli --cmdPrefix oce-delivery

rm -Rf generated/documents-api
node src/cli.js generate-all 'https://docs.oracle.com/en/cloud/paas/content-cloud/rest-api-documents/swagger.json' --target './generated/documents-api' --name oce-documents-cli --cmdPrefix oce-documents

rm -Rf generated/webhooks-api
node src/cli.js generate-all 'https://docs.oracle.com/en/cloud/paas/content-cloud/rest-api-webhooks-management/swagger.json' --target './generated/webhooks-api' --name oce-webhooks-cli --cmdPrefix oce-webhooks

rm -Rf generated/conversations-api
node src/cli.js generate-all 'https://docs.oracle.com/en/cloud/paas/content-cloud/rest-api-conversations/swagger.json' --target './generated/conversations-api' --name oce-conversations-cli --cmdPrefix oce-conversations

rm -Rf generated/users-api
node src/cli.js generate-all 'https://docs.oracle.com/en/cloud/paas/content-cloud/rest-api-users-groups/swagger.json' --target './generated/users-api' --name oce-users-cli --cmdPrefix oce-users


rm -Rf generated/activity-api
node src/cli.js generate-all 'https://docs.oracle.com/en/cloud/paas/content-cloud/rest-api-activity-log/swagger.json' --target './generated/activity-api' --name oce-activity-cli --cmdPrefix oce-activity
