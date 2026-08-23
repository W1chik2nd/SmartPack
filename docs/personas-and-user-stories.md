# Personas and User Stories

This document defines the target user personas for SmartPack and the user stories for each feature area.

## Personas

| Persona | Profile | Key Pain Points |
|---|---|---|
| **Anna, Travel Consultant (28)** | A consultant who travels 2–3 times a month with tight schedules, switching between meetings, commutes, and client dinners | Packing takes time and mental effort; she often overpacks or packs the wrong things, and finds her clothes unsuitable for the occasion or weather after landing |
| **Ben, Commuter (32)** | A software engineer who rushes to catch the subway every morning and does not think much about what to wear | No time to decide what to wear in the morning; frequently caught off guard by rain or temperature drops |
| **Chloe, Travel Enthusiast (24)** | A student / freelancer who loves taking photos and often travels to destinations with very different climates | Wants to look good in a different outfit every day, but suitcase space is limited, and she always forgets small items like adapters and sunscreen |
| **David, Minimalist (35)** | A frequent flyer who travels with carry-on only and wants "the fewest items covering the most scenarios" | Dislikes redundant luggage; wants maximum reuse across outfits but finds planning that reuse himself tedious |
| **Emma, Family Trip Planner (38)** | A mother who travels with her kids and manages clothing and supplies for the whole family | Weather changes around trips, the packing list is long and messy, and her biggest fear is forgetting critical items like medication and rain gear |

## User Stories

### 1. Digital Wardrobe Management

Users add their clothes by entry or photo upload, and the app builds a personal wardrobe database as the foundation for all recommendations.

- **US 1.1** (Persona: Ben)
  As a commuter who doesn't care much about fashion, I want to add clothes quickly by taking photos, so that I don't spend a lot of time cataloguing my wardrobe manually.
- **US 1.2** (Persona: Chloe)
  As a style-conscious traveler, I want the app to record each item's color, season, and style tags, so that the recommended outfits match my taste.
- **US 1.3** (Persona: David)
  As a minimalist, I want to see how often each item gets used, so that I know which clothes are worth keeping and which I can let go.

### 2. Dressing Preference Learning

The app learns the user's style preferences, restrictions (e.g., never wears shorts), and personal temperature sensitivity, making recommendations increasingly personalized.

- **US 2.1** (Persona: Anna)
  As a business professional, I want to set rules like "client meetings require formal wear", so that the AI never suggests casual clothes for important occasions.
- **US 2.2** (Persona: Ben)
  As someone who gets cold easily, I want to tell the app that I feel colder than average, so that the recommended layering is actually comfortable for me.
- **US 2.3** (Persona: Chloe)
  As a user with my own sense of style, I want to like or dislike each recommendation, so that the app understands me better over time.

### 3. Daily Weather-Based Outfit Recommendations

Each morning the app combines the day's weather with the user's wardrobe to deliver a complete, ready-to-wear outfit.

- **US 3.1** (Persona: Ben)
  As a commuter in a hurry, I want a complete outfit I can put on directly every morning, so that I don't have to think before leaving home.
- **US 3.2** (Persona: Ben)
  As someone who is often caught out by the weather, I want the recommendation to automatically include a jacket or rain gear when it turns cold or rainy, so that I don't get soaked or freeze again.
- **US 3.3** (Persona: Emma)
  As a family planner, I want outfit suggestions generated for family members such as my kids, so that getting everyone out the door in the morning is easier.

### 4. Trip-Based Outfit Planning

Before a business trip or vacation, the user enters the destination and itinerary, and the app generates complete outfits per day and per scenario (meetings, commuting, dinners, sightseeing, etc.).

- **US 4.1** (Persona: Anna)
  As a travel consultant, I want day-by-day, scenario-based outfit plans after entering my itinerary (daytime meetings plus evening dinners), so that I don't have to plan it all myself.
- **US 4.2** (Persona: Chloe)
  As a traveler who loves photos, I want no repeated outfits across a multi-day trip, so that every day's photos look fresh.
- **US 4.3** (Persona: Anna)
  As a business traveler whose schedule changes often, I want to regenerate the whole plan with one tap when my itinerary changes, so that last-minute changes don't throw everything off.

### 5. Destination Weather Adjustments

The app provides dynamic outfit adjustments for the destination's specific conditions: temperature swings, rain, and strong sun.

- **US 5.1** (Persona: Chloe)
  As someone traveling to high-altitude or desert regions, I want layering plans for large day–night temperature differences, so that I'm comfortable throughout the day.
- **US 5.2** (Persona: Anna)
  As someone flying to a city in its rainy season, I want to know in advance which days require rain gear and waterproof shoes, so that I never look unprepared in front of clients.
- **US 5.3** (Persona: Emma)
  As a parent traveling with kids, I want sun-protection clothing and product suggestions on days with strong sun, so that my children don't get sunburned.

### 6. Minimal Luggage Plan (Item Reuse)

While covering every scenario, the app maximizes item reuse to generate a packing plan with the fewest possible pieces.

- **US 6.1** (Persona: David)
  As a carry-on-only minimalist, I want the app to tell me the minimum number of items that covers the entire trip, so that I can travel light.
- **US 6.2** (Persona: David)
  As someone who values efficiency, I want to see on which days and in which scenarios each item is reused, so that I can trust the plan actually works.
- **US 6.3** (Persona: Chloe)
  As a traveler with limited suitcase space, I want to adjust the balance between outfit variety and luggage minimization, so that the plan reflects my own trade-offs.

### 7. Travel Essentials Checklist

The app automatically generates a checklist of non-clothing travel items such as umbrellas, power adapters, sunscreen, and medication.

- **US 7.1** (Persona: Emma)
  As a family planner worried about forgetting things, I want a complete checklist I can tick off item by item, so that nothing gets left behind while packing.
- **US 7.2** (Persona: Chloe)
  As an international traveler, I want the app to automatically remind me of destination-specific items like power adapters and visa copies, so that I don't discover I can't charge my phone after landing.
- **US 7.3** (Persona: Anna)
  As a business traveler who always carries certain medication, I want to maintain a personal "always bring" list that is automatically merged into every trip, so that my essentials are never missed.

### 8. Pre-Departure Smart Reminders

Before departure, the app monitors forecast changes and automatically reminds the user to add or remove clothing and items.

- **US 8.1** (Persona: Anna)
  As someone who packs days in advance, I want a push notification to add or remove specific items when the forecast changes before departure, so that my luggage always matches the latest weather.
- **US 8.2** (Persona: Ben)
  As a forgetful person, I want a key reminder (such as "bring an umbrella today") an hour before leaving, so that I don't forget at the last moment.
- **US 8.3** (Persona: Emma)
  As a parent traveling with kids, I want reminders for critical items (medication, rain gear) to have higher priority, so that the truly important things are never missed.

### 9. Subscription and Targeted Recommendations (Monetization)

Core features are free; advanced features (multiple trips, family members, deeper personalization) require a subscription. The app identifies wardrobe gaps and earns commission through targeted recommendations of clothing and travel products.

- **US 9.1** (Persona: Anna)
  As a heavy business traveler, I am willing to subscribe to unlock multi-trip management and unlimited plan generation, because the time it saves me is well worth the price.
- **US 9.2** (Persona: Chloe)
  As a user open to buying new clothes, I want the app to recommend a few purchasable products when my wardrobe lacks a certain item (for example, a sun-protection jacket), so that filling the gap doesn't require browsing on my own.
- **US 9.3** (Persona: David)
  As a user who dislikes ads, I want recommendations to appear only when my wardrobe genuinely lacks something, and to be clearly labeled, so that I never feel spammed.
