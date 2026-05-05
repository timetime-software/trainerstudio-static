# False positive `InputVideoSensitiveContentDetected.PrivacyInformation` when transforming public exercise videos into illustrations

Hi BytePlus / Ark support team,

We are using `dreamina-seedance-2-0-260128` to generate generic illustrated exercise videos from short public fitness reference clips.

Our use case:

- The input videos are public 4-second exercise demonstration clips.
- We use the videos only as motion/reference input.
- The output should not reproduce the original person realistically.
- The desired output is a generic illustrated TrainerStudio-style coach on a white background.
- We provide two reference images for the visual style.
- We use `generate_audio: false`, `duration: 4`, `ratio: "16:9"`, and `watermark: false`.

Some clips are accepted, but several valid exercise clips are rejected with:

```json
{
  "code": "InputVideoSensitiveContentDetected.PrivacyInformation",
  "message": "The request failed because the input video may contain real person.",
  "type": "BadRequest"
}
```

Public CDN examples:

Accepted examples:

- https://cdn.trainerstudio.com/libraries/tsl26/abductor_machine_external/source/abductor_machine_external.mp4
- https://cdn.trainerstudio.com/libraries/tsl26/alternating_barbell_curtsy_squats/source/alternating_barbell_curtsy_squats.mp4

Rejected examples:

- https://cdn.trainerstudio.com/libraries/tsl26/air_bike/source/air_bike.mp4
- https://cdn.trainerstudio.com/libraries/tsl26/adductor_machine_internal/source/adductor_machine_internal.mp4
- https://cdn.trainerstudio.com/libraries/tsl26/alternating_deltoid_raise/source/alternating_deltoid_raise.mp4

Reference images:

- https://cdn.trainerstudio.com/libraries/tsl26/references/man.png
- https://cdn.trainerstudio.com/libraries/tsl26/references/man2.png

Recent reproduction request id:

```text
0217779959883738fef509893d762bd38fa7b39384b546735cb0a
```

Error response:

```json
{
  "error": {
    "code": "InputVideoSensitiveContentDetected.PrivacyInformation",
    "message": "The request failed because the input video may contain real person. Request id: 0217779959883738fef509893d762bd38fa7b39384b546735cb0a",
    "param": "",
    "type": "BadRequest"
  }
}
```

Reproduction request, with auth redacted:

```bash
curl https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ARK_API_KEY>" \
  -d '{
    "model": "dreamina-seedance-2-0-260128",
    "content": [
      {
        "type": "text",
        "text": "Restyle [Video 1] into the TrainerStudio visual style shown in [Image 1] and [Image 2]. The result must be exactly the same exercise demonstration as the original video: preserve the movement, repetitions, timing, body pose sequence, camera angle, framing, crop, scale, and 4-second duration from [Video 1]. Only change the visual appearance. Replace the real athlete with the illustrated trainer character from the reference images, keeping a consistent coach identity, clean fitness illustration style, crisp outlines, simplified anatomy, and smooth vector-like shading. Use a clean pure white background matching the references. Keep the trainer centered and fully visible. Do not add text, labels, logos, captions, watermarks, extra people, extra props, gym backgrounds, decorative elements, or equipment that is not necessary for the original exercise movement. The output must be silent, seamless, instructional, and suitable for a public exercise CDN."
      },
      {
        "type": "image_url",
        "image_url": {
          "url": "https://cdn.trainerstudio.com/libraries/tsl26/references/man.png"
        },
        "role": "reference_image"
      },
      {
        "type": "image_url",
        "image_url": {
          "url": "https://cdn.trainerstudio.com/libraries/tsl26/references/man2.png"
        },
        "role": "reference_image"
      },
      {
        "type": "video_url",
        "video_url": {
          "url": "https://cdn.trainerstudio.com/libraries/tsl26/air_bike/source/air_bike.mp4"
        },
        "role": "reference_video"
      }
    ],
    "generate_audio": false,
    "ratio": "16:9",
    "duration": 4,
    "watermark": false
  }'
```

Could you please confirm whether this is an expected policy limitation for public exercise reference videos, or whether these are false positives that can be reviewed/allowed for our use case?
