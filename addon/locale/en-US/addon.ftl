# Menuitem labels (used in the context menu)
menuitem-authenticate-label = Unauthorized. Please authenticate first.
menuitem-syncEntry-label = Sync item with BibSonomy
menuitem-getBibSonomyURL-label = Copy BibSonomy URL to Clipboard

# Alerts
alert-credentials-not-set = Please fill in your BibSonomy credentials in the preferences.
alert-unauthorized = Credentials not valid, please authenticate again in the preferences.
alert-no-item-selected = Error: No item selected.
alert-duplicate-item = Error: Duplicate item detected, a publication with the same BibTeX key already exists in your BibSonomy account.
alert-unexpected-error = Error: { $message }
alert-default-group-not-set = Error: Default group not set. Please set a default group in the preferences.

# Progress windows 
progress-sync-entry-text = Adding publication { $title } to BibSonomy...
progress-sync-entry-success = Publication synced successfully! (Link copied to clipboard)
progress-sync-entry-error = Error: Publication could not be synced.
progress-update-entry-text = Updating publication { $title } on BibSonomy...
progress-delete-entry-text = Deleting publication { $title } from BibSonomy...
progress-upload-files-text = Uploading attachments for { $title }
progress-unauthorized-error = User is not authenticated, skipping sync
progress-error-help-link = Need help?
# TODO: Write actually helpful messages
progress-error-help-message-unauthorized = This error might be due to network connectivity issues. Please check your internet connection and try again.
progress-error-help-message-post-not-found = This error might be due to network connectivity issues. Please check your internet connection and try again.
progress-error-help-message-invalid-format = This error might be due to network connectivity issues. Please check your internet connection and try again.
progress-error-help-message-unexpected = An unexpected error occurred. Please try again or file an issue at https://github.com/zotero-bibsonomy/zotero-bibsonomy/issues.
progress-error-help-message-invalid-bibtex = The BibTeX you are trying to sync is invalid. Please check the BibTeX and try again.

# Delete confirmation dialog
dialog-delete-confirm-title = Confirm Online Deletion
dialog-delete-confirm-message = Do you also want to delete the Post "{ $title }" from your BibSonomy Account?
dialog-delete-confirm-yes = Yes
dialog-delete-confirm-no = No