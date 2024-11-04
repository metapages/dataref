
# @metapages/dataref

Moving around large blobs of data is hard and complicated. 

Datarefs are small bits of JSON that **reference** some underlying data.

This module provides types and tooling for converting different data types (including Blobs, Files, ArrayBuffers, JSON, strings) into small references that can be more easily passed around your network and database.

Then when some process wants the actual underlying data, the `dataref` tooling provides the way to fetch/convert the `dataref` into the corresponding data.