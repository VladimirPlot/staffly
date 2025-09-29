package ru.staffly.training.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.media.TrainingImageStorage;
import ru.staffly.training.dto.TrainingItemDto;
import ru.staffly.training.mapper.TrainingItemMapper;
import ru.staffly.training.model.TrainingItem;
import ru.staffly.training.repository.TrainingItemRepository;
import ru.staffly.security.SecurityService;

import java.io.IOException;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/training/items")
@RequiredArgsConstructor
public class TrainingItemImageController {

    private final TrainingItemRepository items;
    private final TrainingImageStorage storage;
    private final TrainingItemMapper itemMapper;
    private final SecurityService security;

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping(value = "/{itemId}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public TrainingItemDto uploadImage(@PathVariable Long restaurantId,
                                       @PathVariable Long itemId,
                                       @RequestParam("file") MultipartFile file) throws IOException {
        var item = items.findById(itemId)
                .orElseThrow(() -> new NotFoundException("Item not found: " + itemId));

        var cat = item.getCategory();
        if (!cat.getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Item belongs to another restaurant");
        }

        // удалить старый файл (если был)
        storage.deleteByPublicUrl(item.getImageUrl());

        String publicUrl = storage.saveForItem(itemId, file);
        item.setImageUrl(publicUrl);
        // @Transactional — сохранит
        return itemMapper.toDto(item);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/{itemId}/image")
    @Transactional
    public TrainingItemDto deleteImage(@PathVariable Long restaurantId,
                                       @PathVariable Long itemId) throws IOException {
        var item = items.findById(itemId)
                .orElseThrow(() -> new NotFoundException("Item not found: " + itemId));

        if (!item.getCategory().getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Item belongs to another restaurant");
        }

        storage.deleteByPublicUrl(item.getImageUrl());
        item.setImageUrl(null);
        return itemMapper.toDto(item);
    }
}