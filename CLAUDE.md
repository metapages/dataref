# Store complex binary types in references

Encode any javascript type including TypedArrays into data URL strings for embedding any types in URL parameters.

## Current Task:

We are migrating from v1 datarefs, where the data reference is a json blob, to a special string. The problem with the v1 json version is that it might be mistaken for other non-dataref values. in v2, we use data url string, extending existing data urls with our custom payloads.

The new v2 code must be backwards compatible with v1.



1. Write tests for the new v2, converting to and from all the basic types.
2. Add a new function that takes a json, then traverses the json, and converts any data ref strings into the dereferenced data, returning the new json. Use the npm module mutative to make the modifications. Make sure to include tests. 
3. Be backwards compatible and test for it. 