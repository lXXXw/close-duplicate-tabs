# close-duplicate-tabs
A chrome extension which allows you to close duplicate tabs and define customer rules to close tabs whose urls match a pattern.

# Functionalities

## Close Duplicates - Default Rule
This is done by capturing a keybord shortcut - ctrl+shift+x. When this is triggered, extension will go through all the opened tabs and close any duplicated tabs by comparing their URLs. When closing the tabs, the following rules are respected:

1. For a group of duplicated urls, keep only one open tabl and close the rest.
2. If the currently focused tab is within a group of duplicated tabs, keep the currently-focused tab and close the others.
3. This behavior should only apply to the current browser window.

## Close Duplicates - Customized Rule
This is the more advanced feature: It smartly close tabs with similar URLs. User can trigger this by clicking the chrome icon and click the button from a popup minipage. In the minipage:

- There are buttons for pre-defined rules and customized rules.
- There is an option which allows the user to create a new customized rule by giving the rule name and matching regex.

### Pre-defined Rules

- Ignore URL parameters: This allows closing tabs from the same page of the domain but with different url parameters. e.g. "http://mydomain.com/mypage?who=you" and "http://mydomain.com/mypage?who=him" will be considered as duplicates by this rule while they are treated as different urls by the default rule so they will both be kept if user trigger the default behavior of this extension.
- There should be other pre-defined rules added in the future.

### Customized Rules

There should be UI elements to create, edit and remove customized rules. Customized rule consists of <name, regex> pair. This is where the user can define regex to capture the common parts of the URL so we can close them all at once. But still, we do not close the currently-focused tab.

# Build
This extension should be pretty lightweight and simple. The background script should only be listening to the keyboard shortcut. And when a rule is triggered, either from the keyboard shortcut or from the UI clicking, the extension collects a list of URLs of the open tabs, and dedupe them based on the rule triggered. The tricky part would be how to make sure the currently-focused tab will not be closed.

## Rule Object
We should define a class for `Rule` objects. It should be flexible enough so both the default rule, predefined rule and customized rule can be created and used easily.

