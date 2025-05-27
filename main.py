import pygame

# Initialize Pygame
pygame.init()

# Screen dimensions
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600

# Create the screen
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))

# Set window title
pygame.display.set_caption("River Raid Clone")

# Load player image
try:
    player_img = pygame.image.load("player.png") # Ensure player.png is in the same directory
    player_img = player_img.convert_alpha() # For transparency
except pygame.error as e:
    print(f"Unable to load image player.png: {e}")
    # Create a placeholder surface if image loading fails
    player_img = pygame.Surface((50, 50), pygame.SRCALPHA)
    pygame.draw.polygon(player_img, (255, 0, 0), [(0, 50), (25, 0), (50, 50)]) # Red triangle

player_rect = player_img.get_rect()
player_rect.centerx = SCREEN_WIDTH // 2
player_rect.bottom = SCREEN_HEIGHT - 10 # 10 pixels from the bottom

# Player speed
player_speed = 5

# Game loop
running = True
clock = pygame.time.Clock()

while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    # Handle keyboard input
    keys = pygame.key.get_pressed()
    if keys[pygame.K_LEFT]:
        player_rect.x -= player_speed
    if keys[pygame.K_RIGHT]:
        player_rect.x += player_speed

    # Keep player on screen
    if player_rect.left < 0:
        player_rect.left = 0
    if player_rect.right > SCREEN_WIDTH:
        player_rect.right = SCREEN_WIDTH

    # Fill the screen with a color (e.g., blue for water)
    screen.fill((0, 0, 255))

    # Draw the player
    screen.blit(player_img, player_rect)

    # Update the display
    pygame.display.flip()

    # Cap the frame rate
    clock.tick(60)

# Quit Pygame
pygame.quit()
